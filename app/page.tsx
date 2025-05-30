"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Square, Volume2 } from "lucide-react"

// Character definitions
const characters = {
  daVinci: {
    id: "daVinci",
    name: "Leonardo da Vinci",
    image: "/placeholder.svg?height=100&width=100&text=Leonardo",
    description: "Renaissance polymath, artist, and inventor",
    systemPrompt:
      "You are Leonardo da Vinci, the great Renaissance polymath. Speak with curiosity about art, science, and invention. Keep responses concise but thoughtful.",
    voice: "echo",
  },
  socrates: {
    id: "socrates",
    name: "Socrates",
    image: "/placeholder.svg?height=100&width=100&text=Socrates",
    description: "Ancient Greek philosopher",
    systemPrompt:
      "You are Socrates, the ancient Greek philosopher. Use the Socratic method, asking probing questions. Be wise but humble.",
    voice: "echo",
  },
  frida: {
    id: "frida",
    name: "Frida Kahlo",
    image: "/placeholder.svg?height=100&width=100&text=Frida",
    description: "Mexican artist known for self-portraits",
    systemPrompt:
      "You are Frida Kahlo, the passionate Mexican artist. Speak with intensity about art, pain, love, and identity.",
    voice: "nova",
  },
  shakespeare: {
    id: "shakespeare",
    name: "William Shakespeare",
    image: "/placeholder.svg?height=100&width=100&text=Shakespeare",
    description: "English playwright and poet",
    systemPrompt:
      "You are William Shakespeare, the Bard of Avon. Speak poetically but accessibly about human nature, love, and drama.",
    voice: "echo",
  },
  mozart: {
    id: "mozart",
    name: "Wolfgang Amadeus Mozart",
    image: "/placeholder.svg?height=100&width=100&text=Mozart",
    description: "Classical composer and musical genius",
    systemPrompt:
      "You are Wolfgang Amadeus Mozart, the classical composer. Speak passionately about music, creativity, and artistic expression.",
    voice: "echo",
  },
}

type Mode = "select" | "chat" | "debate"
type Character = keyof typeof characters

export default function HeroesOfHistory() {
  // Core state
  const [mode, setMode] = useState<Mode>("select")
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [debateCharacters, setDebateCharacters] = useState<[Character | null, Character | null]>([null, null])

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: string; content: string; audio?: string }>>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Audio state
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)

  // Debate state
  const [debateTopic, setDebateTopic] = useState("")
  const [debateMessages, setDebateMessages] = useState<
    Array<{ character: Character; content: string; audio?: string }>
  >([])
  const [currentSpeaker, setCurrentSpeaker] = useState<Character | null>(null)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Initialize speech recognition
  const [recognition, setRecognition] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const speechRecognition = new (window as any).webkitSpeechRecognition()
      speechRecognition.continuous = false
      speechRecognition.interimResults = false
      speechRecognition.lang = "en-US"

      speechRecognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
      }

      speechRecognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)
        setIsRecording(false)
      }

      speechRecognition.onend = () => {
        setIsRecording(false)
      }

      setRecognition(speechRecognition)
    }
  }, [])

  // Audio controls
  const startRecording = useCallback(() => {
    if (recognition) {
      setIsRecording(true)
      recognition.start()
    }
  }, [recognition])

  const stopRecording = useCallback(() => {
    if (recognition && isRecording) {
      recognition.stop()
      setIsRecording(false)
    }
  }, [recognition, isRecording])

  const playAudio = useCallback(
    (audioUrl: string) => {
      if (currentAudio) {
        currentAudio.pause()
      }

      const audio = new Audio(audioUrl)
      audio.onplay = () => setIsPlaying(true)
      audio.onended = () => {
        setIsPlaying(false)
        setCurrentAudio(null)
      }
      audio.onerror = () => {
        setIsPlaying(false)
        setCurrentAudio(null)
      }

      setCurrentAudio(audio)
      audio.play()
    },
    [currentAudio],
  )

  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause()
      setIsPlaying(false)
      setCurrentAudio(null)
    }
  }, [currentAudio])

  // Chat functionality
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !selectedCharacter || isLoading) return

    const userMessage = { role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // Get AI response
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          character: selectedCharacter,
        }),
      })

      if (!chatResponse.ok) throw new Error("Failed to get response")

      const chatData = await chatResponse.json()

      // Generate audio
      const audioResponse = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: chatData.content,
          voice: characters[selectedCharacter].voice,
        }),
      })

      let audioUrl = ""
      if (audioResponse.ok) {
        const audioData = await audioResponse.json()
        audioUrl = audioData.audioUrl
      }

      const assistantMessage = {
        role: "assistant",
        content: chatData.content,
        audio: audioUrl,
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Auto-play audio
      if (audioUrl) {
        playAudio(audioUrl)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I apologize, but I'm having trouble responding right now. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, selectedCharacter, messages, isLoading, playAudio])

  // Debate functionality
  const startDebate = useCallback(async () => {
    if (!debateCharacters[0] || !debateCharacters[1] || !debateTopic.trim() || isLoading) return

    setIsLoading(true)
    setDebateMessages([])

    try {
      const response = await fetch("/api/start-debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character1: debateCharacters[0],
          character2: debateCharacters[1],
          topic: debateTopic.trim(),
        }),
      })

      if (!response.ok) throw new Error("Failed to start debate")

      const data = await response.json()

      const newMessages = [
        {
          character: debateCharacters[0],
          content: data.opening1,
          audio: data.audioUrl1,
        },
        {
          character: debateCharacters[1],
          content: data.opening2,
          audio: data.audioUrl2,
        },
      ]

      setDebateMessages(newMessages)
      setCurrentSpeaker(debateCharacters[0])

      // Play first response
      if (data.audioUrl1) {
        playAudio(data.audioUrl1)
      }
    } catch (error) {
      console.error("Error starting debate:", error)
    } finally {
      setIsLoading(false)
    }
  }, [debateCharacters, debateTopic, isLoading, playAudio])

  // Reset functions
  const resetToSelection = useCallback(() => {
    setMode("select")
    setSelectedCharacter(null)
    setDebateCharacters([null, null])
    setMessages([])
    setDebateMessages([])
    setInput("")
    setDebateTopic("")
    stopAudio()
  }, [stopAudio])

  const startChat = useCallback((character: Character) => {
    setSelectedCharacter(character)
    setMode("chat")
    setMessages([])
  }, [])

  const startDebateMode = useCallback(() => {
    setMode("debate")
    setDebateMessages([])
    setDebateTopic("")
  }, [])

  // Character selection screen
  if (mode === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Heroes of History</h1>
            <p className="text-xl text-gray-300">Choose your experience</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Ask Questions</CardTitle>
                <CardDescription className="text-gray-300">
                  Have a conversation with a historical figure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(characters).map(([id, character]) => (
                    <div key={id} onClick={() => startChat(id as Character)} className="cursor-pointer group">
                      <div className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors">
                        <img
                          src={character.image || "/placeholder.svg"}
                          alt={character.name}
                          className="w-16 h-16 mx-auto rounded-full mb-2"
                        />
                        <h3 className="text-white text-sm font-medium text-center">{character.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Watch Debates</CardTitle>
                <CardDescription className="text-gray-300">See historical figures debate each other</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={startDebateMode} className="w-full bg-purple-600 hover:bg-purple-700">
                  Start Debate Setup
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Chat mode
  if (mode === "chat" && selectedCharacter) {
    const character = characters[selectedCharacter]
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <img
                  src={character.image || "/placeholder.svg"}
                  alt={character.name}
                  className="w-16 h-16 rounded-full"
                />
                <div>
                  <h1 className="text-2xl font-bold text-white">{character.name}</h1>
                  <p className="text-gray-300">{character.description}</p>
                </div>
              </div>
              <Button onClick={resetToSelection} variant="outline">
                Back to Selection
              </Button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 mb-6 h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 mt-20">
                <p>Start a conversation with {character.name}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-700 text-white"
                      }`}
                    >
                      <p>{message.content}</p>
                      {message.audio && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => playAudio(message.audio!)}
                          className="mt-2 p-1 h-auto"
                        >
                          <Volume2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask a question..."
                className="flex-1 bg-gray-700 border-gray-600 text-white"
                disabled={isLoading}
              />
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
              >
                {isRecording ? <MicOff /> : <Mic />}
              </Button>
              <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
                Send
              </Button>
            </div>

            {isPlaying && (
              <div className="mt-4 flex items-center justify-center space-x-2">
                <Button onClick={stopAudio} size="sm" variant="outline">
                  <Square className="w-4 h-4" />
                </Button>
                <span className="text-gray-300">Playing audio...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Debate mode
  if (mode === "debate") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">Historical Debate</h1>
              <Button onClick={resetToSelection} variant="outline">
                Back to Selection
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-white font-medium mb-3">Select First Debater</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(characters).map(([id, character]) => (
                    <div
                      key={id}
                      onClick={() => setDebateCharacters([id as Character, debateCharacters[1]])}
                      className={`cursor-pointer p-3 rounded-lg border-2 transition-colors ${
                        debateCharacters[0] === id
                          ? "border-blue-500 bg-blue-900/50"
                          : "border-gray-600 bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      <img
                        src={character.image || "/placeholder.svg"}
                        alt={character.name}
                        className="w-12 h-12 mx-auto rounded-full mb-2"
                      />
                      <p className="text-white text-sm text-center">{character.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-white font-medium mb-3">Select Second Debater</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(characters).map(([id, character]) => (
                    <div
                      key={id}
                      onClick={() => setDebateCharacters([debateCharacters[0], id as Character])}
                      className={`cursor-pointer p-3 rounded-lg border-2 transition-colors ${
                        debateCharacters[1] === id
                          ? "border-red-500 bg-red-900/50"
                          : "border-gray-600 bg-gray-700 hover:bg-gray-600"
                      } ${debateCharacters[0] === id ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <img
                        src={character.image || "/placeholder.svg"}
                        alt={character.name}
                        className="w-12 h-12 mx-auto rounded-full mb-2"
                      />
                      <p className="text-white text-sm text-center">{character.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <Input
                value={debateTopic}
                onChange={(e) => setDebateTopic(e.target.value)}
                placeholder="Enter debate topic (e.g., 'The role of art in society')"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <Button
              onClick={startDebate}
              disabled={!debateCharacters[0] || !debateCharacters[1] || !debateTopic.trim() || isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? "Starting Debate..." : "Start Debate"}
            </Button>
          </div>

          {debateMessages.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  {debateCharacters[0] &&
                    debateCharacters[1] &&
                    `${characters[debateCharacters[0]].name} vs ${characters[debateCharacters[1]].name}`}
                </h2>
                <Badge variant="outline" className="text-gray-300">
                  Topic: {debateTopic}
                </Badge>
              </div>

              <div className="space-y-4">
                {debateMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.character === debateCharacters[0] ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-2xl p-4 rounded-lg ${
                        message.character === debateCharacters[0]
                          ? "bg-blue-900/50 border-l-4 border-blue-500"
                          : "bg-red-900/50 border-r-4 border-red-500"
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <img
                          src={characters[message.character].image || "/placeholder.svg"}
                          alt={characters[message.character].name}
                          className="w-8 h-8 rounded-full"
                        />
                        <span className="text-white font-medium">{characters[message.character].name}</span>
                        {message.audio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => playAudio(message.audio!)}
                            className="p-1 h-auto"
                          >
                            <Volume2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-gray-200">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {isPlaying && (
                <div className="mt-6 flex items-center justify-center space-x-2">
                  <Button onClick={stopAudio} size="sm" variant="outline">
                    <Square className="w-4 h-4" />
                  </Button>
                  <span className="text-gray-300">Playing audio...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
