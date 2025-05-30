"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Layout from "../components/layout"
import EmbeddedTopicSelector from "../components/embedded-topic-selector"

export default function Home() {
  const [selectedPersona, setSelectedPersona] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioError, setAudioError] = useState(null)
  const [mode, setMode] = useState("question") // 'question' or 'debate'
  const [selectedCharacters, setSelectedCharacters] = useState([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(true)
  const [voiceIds, setVoiceIds] = useState({})
  const [thinkingMessage, setThinkingMessage] = useState("")
  const [personas, setPersonas] = useState({})
  const [showTopicSelector, setShowTopicSelector] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Debate state
  const [isDebating, setIsDebating] = useState(false)
  const [debateTopic, setDebateTopic] = useState("")
  const [debateMessages, setDebateMessages] = useState([])
  const [currentSpeaker, setCurrentSpeaker] = useState(null)
  const [speakerStatus, setSpeakerStatus] = useState(null)
  const [audioContextUnlocked, setAudioContextUnlocked] = useState(false)
  const [requiresUserInteraction, setRequiresUserInteraction] = useState(false)

  // Audio refs
  const audioRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const currentPersonaRef = useRef("") // Use ref to track current persona
  const selectedCharactersRef = useRef([])
  const debateMessagesRef = useRef([])
  const voiceIdsRef = useRef(voiceIds)
  const debateTopicRef = useRef("")
  const currentAudioRef = useRef(null)

  // Update refs when state changes
  useEffect(() => {
    selectedCharactersRef.current = selectedCharacters
    debateMessagesRef.current = debateMessages
    voiceIdsRef.current = voiceIds
  }, [selectedCharacters, debateMessages, voiceIds])

  // Thinking messages for dynamic display
  const thinkingMessages = [
    "Thinking...",
    "Pondering your question...",
    "Reflecting on this matter...",
    "Considering the depths of this inquiry...",
    "Gathering thoughts...",
    "Contemplating...",
    "Preparing a response...",
    "Delving into wisdom...",
    "Searching through memories...",
    "Formulating thoughts...",
  ]

  // Load voice IDs when component mounts
  useEffect(() => {
    async function loadVoiceIds() {
      try {
        const response = await fetch("/api/get-voice-ids")
        if (response.ok) {
          const data = await response.json()
          setVoiceIds(data)
          console.log("Voice IDs loaded:", data)

          // Update personas with voice IDs
          Object.keys(personas).forEach((key) => {
            const voiceKey = key === "daVinci" ? "davinci" : key.toLowerCase()
            if (data[voiceKey]) {
              personas[key].voiceId = data[voiceKey]
              console.log(`Updated voice ID for ${key}: ${data[voiceKey]}`)
            }
          })
        } else {
          console.error("Failed to load voice IDs")
        }
      } catch (error) {
        console.error("Error loading voice IDs:", error)
      } finally {
        setIsLoadingVoices(false)
      }
    }

    loadVoiceIds()
  }, [personas])

  // Load personas when component mounts
  useEffect(() => {
    async function loadPersonas() {
      try {
        const personasModule = await import("../lib/personas")
        setPersonas(personasModule.personas)
        console.log("Personas loaded:", Object.keys(personasModule.personas))
      } catch (error) {
        console.error("Error loading personas:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPersonas()
  }, [])

  // Update ref when selectedPersona changes
  useEffect(() => {
    currentPersonaRef.current = selectedPersona
    console.log("Selected persona updated to:", selectedPersona)
  }, [selectedPersona])

  // Thinking message rotation effect
  useEffect(() => {
    let interval
    if (isProcessing) {
      let messageIndex = 0
      setThinkingMessage(thinkingMessages[0])

      interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % thinkingMessages.length
        setThinkingMessage(thinkingMessages[messageIndex])
      }, 2000) // Change message every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isProcessing])

  const handleCharacterSelect = useCallback(
    async (characterId) => {
      console.log("Character selected:", characterId)
      if (mode === "question") {
        // Update both state and ref immediately
        setSelectedPersona(characterId)
        currentPersonaRef.current = characterId
        setSelectedCharacters([characterId])

        console.log("About to start listening for:", characterId)
        // Start recording immediately
        await startListening()
      } else if (mode === "debate") {
        setSelectedCharacters((prev) => {
          const isSelected = prev.includes(characterId)
          let newSelection

          if (isSelected) {
            newSelection = prev.filter((key) => key !== characterId)
          } else if (prev.length < 2) {
            newSelection = [...prev, characterId]
          } else {
            newSelection = [prev[1], characterId]
          }

          console.log("Selected persona updated to:", newSelection)

          if (newSelection.length === 2) {
            console.log("Two characters selected, showing topic selector")
            setShowTopicSelector(true)
          } else {
            setShowTopicSelector(false)
          }

          return newSelection
        })
      }
    },
    [mode],
  )

  const startListening = useCallback(async () => {
    try {
      console.log("Starting to listen...")
      setAudioError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped")
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        await processAudioQuestion(audioBlob)
      }

      mediaRecorder.start()
      setIsListening(true)
      console.log("Recording started")
    } catch (error) {
      console.error("Error accessing microphone:", error)
      setAudioError("Could not access microphone. Please check permissions.")
    }
  }, [])

  const stopListening = useCallback(() => {
    console.log("Stop listening called")
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      setIsListening(false)
      console.log("MediaRecorder stopped")
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log("Track stopped:", track.kind)
      })
      streamRef.current = null
    }
  }, [])

  const pauseAudio = useCallback(() => {
    console.log("Pause audio called")
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPlaying(false)
      console.log("Audio paused")
    }
  }, [])

  const resumeAudio = useCallback(() => {
    console.log("Resume audio called")
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play()
      setIsPlaying(true)
      console.log("Audio resumed")
    }
  }, [])

  const stopAudio = useCallback(() => {
    console.log("Stop audio called")
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      console.log("Audio stopped")
    }
  }, [])

  const processAudioQuestion = useCallback(async (audioBlob) => {
    // Use the ref value instead of state
    const currentPersona = currentPersonaRef.current
    console.log("Processing audio question, selectedPersona from ref:", currentPersona)

    if (!currentPersona) {
      console.error("No persona selected!")
      setAudioError("Please select a character first")
      return
    }

    setIsProcessing(true)
    setAudioError(null)

    try {
      // Convert audio to text
      const formData = new FormData()
      formData.append("audio", audioBlob, "question.wav")

      const transcriptionResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      })

      if (!transcriptionResponse.ok) {
        throw new Error("Failed to transcribe audio")
      }

      const { text } = await transcriptionResponse.json()
      console.log("Transcribed text:", text)

      if (!text || text.trim().length === 0) {
        throw new Error("No speech detected. Please try again.")
      }

      // Start parallel processing: text generation and audio preparation
      await processQuestionWithStreaming(text, currentPersona)
    } catch (error) {
      console.error("Error processing audio question:", error)
      setAudioError(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
      setThinkingMessage("")
    }
  }, [])

  // New function for parallel processing with streaming
  const processQuestionWithStreaming = async (question, persona) => {
    try {
      setIsPlaying(true)

      // Start text generation
      const textPromise = fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: question,
          persona: persona,
        }),
      })

      // Wait for text response
      const textResponse = await textPromise
      if (!textResponse.ok) {
        throw new Error("Failed to generate response")
      }

      const { response: responseText } = await textResponse.json()
      console.log("Generated response:", responseText)

      // Use regular audio generation instead of streaming to avoid 504 errors
      await generateAudioResponse(responseText, persona)
    } catch (error) {
      console.error("Error in parallel processing:", error)
      setAudioError(`Error: ${error.message}`)
      setIsPlaying(false)
    }
  }

  // Fallback to regular audio generation to avoid 504 timeouts
  const generateAudioResponse = async (text, persona) => {
    try {
      // Get voice for character
      const character = personas[persona]
      const voice = character?.voiceId || (character?.getVoiceId ? character.getVoiceId() : "echo")

      console.log(`Generating audio for ${persona} with voice: ${voice}`)

      // Use regular speak API instead of streaming
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          voice: voice,
        }),
      })

      if (!response.ok) {
        throw new Error(`Audio generation failed: ${response.status}`)
      }

      const { audioUrl } = await response.json()

      // Create audio element and play
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsPlaying(false)
        console.log("Audio playback completed")
      }

      audio.onerror = (e) => {
        console.error("Audio playback error:", e)
        setAudioError("Audio playback failed")
        setIsPlaying(false)
      }

      await audio.play()
      console.log("Started audio playback")
    } catch (error) {
      console.error("Error in audio generation:", error)
      setAudioError(`Audio error: ${error.message}`)
      setIsPlaying(false)
    }
  }

  // Get voice for character - use the voice IDs from the API
  const getVoiceForCharacter = (characterId) => {
    if (!personas[characterId]) return "echo"

    // Use the voiceIds state that was loaded from the API
    const voiceKey = characterId === "daVinci" ? "davinci" : characterId.toLowerCase()

    if (voiceIds[voiceKey]) {
      console.log(`🔍 [DEBATE VOICE DEBUG] Using voice ID for ${characterId}: ${voiceIds[voiceKey]}`)
      return voiceIds[voiceKey] // Return the actual voice ID, not the key
    }

    // Fallback to default voice
    console.log(`🔍 [DEBATE VOICE DEBUG] No voice ID found for ${characterId}, using fallback: echo`)
    return "echo"
  }

  // Handle debate topic selection - THIS IS THE MISSING CONNECTION!
  const handleTopicSelect = useCallback((topic) => {
    console.log("🎯 [TOPIC SELECT] Topic selected:", topic)
    startDebateWithCharacters(topic)
  }, [])

  // Handle debate end/reset
  const handleDebateEnd = useCallback(() => {
    console.log("🎯 [DEBATE END] Debate manually ended, returning to home")
    resetDebate()
  }, [])

  // Small microphone icon component - Fixed SVG path
  const SmallMicIcon = ({ isActive }) => (
    <svg
      className={`w-4 h-4 ${isActive ? "text-orange-400 animate-pulse" : "text-gray-400"}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  )

  // Get status text for button display
  const getStatusText = (characterId) => {
    if (selectedPersona !== characterId) return "Ask Question"

    if (isListening) return "Stop Recording"
    if (isProcessing) return thinkingMessage || "Processing..."
    if (isPlaying) return "Speaking..."
    return "Ask Question"
  }

  // Get button color based on status
  const getButtonColor = (characterId) => {
    if (selectedPersona !== characterId) return "bg-gray-700 text-white hover:bg-gray-600"

    if (isListening) return "bg-red-500 text-white"
    if (isProcessing) return "bg-blue-500 text-white"
    if (isPlaying) return "bg-green-500 text-white"
    return "bg-yellow-500 text-black"
  }

  // Determine if character should be grayed out
  const shouldGrayOutCharacter = (characterId) => {
    if (mode === "question") {
      const isInteracting = isListening || isProcessing || isPlaying
      return isInteracting && selectedPersona !== characterId
    } else if (mode === "debate") {
      // In debate mode, gray out if 2 characters are selected and this isn't one of them
      return selectedCharacters.length === 2 && !selectedCharacters.includes(characterId)
    }
    return false
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full mb-4"></div>
            <p className="text-yellow-400">Loading personas...</p>
          </div>
        </div>
      </Layout>
    )
  }

  const unlockAudioContext = async () => {
    try {
      console.log("🔊 [MOBILE DEBUG] Unlocking audio context with user interaction...")

      // Create a dummy audio element and play it
      const dummyAudio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
      )
      dummyAudio.volume = 0.01
      await dummyAudio.play()

      setAudioContextUnlocked(true)
      setRequiresUserInteraction(false)

      console.log("🔊 [MOBILE DEBUG] Audio context unlocked successfully!")

      // If we have a pending debate topic, start it now
      if (debateTopicRef.current && !isDebating) {
        startDebateWithCharacters(debateTopicRef.current)
      }
    } catch (error) {
      console.error("🔊 [MOBILE DEBUG] Failed to unlock audio context:", error)
      setAudioError("Please tap the screen to enable audio playback")
    }
  }

  const startDebateWithCharacters = async (topic) => {
    if (!selectedCharacters || selectedCharacters.length !== 2) {
      setAudioError("Please select exactly two characters to start a debate")
      return
    }

    const topicString = typeof topic === "object" ? topic.title || topic.description || String(topic) : topic

    setIsDebating(true)
    setDebateTopic(topicString)
    debateTopicRef.current = topicString
    setCurrentSpeaker(selectedCharacters[0])
    setSpeakerStatus("thinking")
    setDebateMessages([])

    try {
      const response = await fetch("/api/start-debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character1: selectedCharacters[0],
          character2: selectedCharacters[1],
          topic: topicString,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to start debate: ${response.status}`)
      }

      const data = await response.json()

      const messages = [
        {
          character: selectedCharacters[0],
          content: data.opening1,
          timestamp: Date.now(),
        },
        {
          character: selectedCharacters[1],
          content: data.opening2,
          timestamp: Date.now() + 100,
        },
      ]

      setDebateMessages(messages)
      playDebateAudio(messages[0], messages, 0)
    } catch (error) {
      console.error("Error starting debate:", error)
      setAudioError(`Failed to start debate: ${error.message}`)
      setIsDebating(false)
      setSpeakerStatus(null)
      setCurrentSpeaker(null)
    }
  }

  // Audio playback for debates
  const playDebateAudio = async (message, allMessages, currentIndex) => {
    const { character, content } = message

    setCurrentSpeaker(character)
    setSpeakerStatus("thinking")

    try {
      const voiceKey = character === "daVinci" ? "davinci" : character.toLowerCase()
      const currentVoiceIds = voiceIdsRef.current
      const voice = currentVoiceIds[voiceKey] || "echo"

      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, voice }),
      })

      if (!response.ok) {
        throw new Error(`Audio API returned ${response.status}`)
      }

      const data = await response.json()
      const audio = new Audio(data.audioUrl)
      currentAudioRef.current = audio

      // Add mobile-specific audio event handlers
      audio.addEventListener("canplaythrough", () => {
        console.log("🔊 [MOBILE DEBUG] Audio can play through")
      })

      audio.addEventListener("playing", () => {
        console.log("🔊 [MOBILE DEBUG] Audio started playing")
        setSpeakerStatus("speaking")
      })

      audio.addEventListener("error", (e) => {
        console.error("🔊 [MOBILE DEBUG] Audio error:", e)
        console.error("🔊 [MOBILE DEBUG] Audio error details:", audio.error)

        // If audio fails, show user interaction prompt
        if (!audioContextUnlocked) {
          setRequiresUserInteraction(true)
          setAudioError("Tap 'Enable Audio' to continue the debate")
          return
        }

        throw new Error(`Audio playback failed: ${audio.error?.message || "Unknown error"}`)
      })

      audio.onended = () => {
        console.log("🔊 [MOBILE DEBUG] Audio ended")
        setSpeakerStatus("waiting")

        const nextIndex = currentIndex + 1
        if (nextIndex < allMessages.length) {
          setTimeout(() => {
            playDebateAudio(allMessages[nextIndex], allMessages, nextIndex)
          }, 1000)
        } else {
          if (allMessages.length < 8) {
            setTimeout(() => {
              continueDebate()
            }, 2000)
          } else {
            setTimeout(() => {
              resetDebate()
            }, 3000)
          }
        }
      }
    } catch (error) {
      console.error(`🔊 [MOBILE DEBUG] Error playing audio for ${character}:`, error)

      // Check if it's a user interaction issue
      if (
        error?.name === "NotAllowedError" ||
        error?.message?.includes("user agent") ||
        error?.message?.includes("autoplay")
      ) {
        setRequiresUserInteraction(true)
        setAudioError("Tap 'Enable Audio' to continue the debate")
        setSpeakerStatus("waiting")
        return
      }

      setAudioError(`Audio failed for ${character}: ${error.message}`)
      setSpeakerStatus(null)

      // Continue to next message even if audio fails
      const nextIndex = currentIndex + 1
      if (nextIndex < allMessages.length) {
        setTimeout(() => {
          playDebateAudio(allMessages[nextIndex], allMessages, nextIndex)
        }, 2000)
      } else {
        setTimeout(() => {
          resetDebate()
        }, 2000)
      }
    }
  }

  // Continue debate function
  const continueDebate = async () => {
    if (isProcessing) return

    console.log("🎯 [CONTINUE DEBATE] Continuing debate...")
    setIsProcessing(true)
    setSpeakerStatus("thinking")

    try {
      const currentCharacters = selectedCharactersRef.current
      const currentMessages = debateMessagesRef.current

      console.log("🎯 [CONTINUE DEBATE] Current characters:", currentCharacters)
      console.log("🎯 [CONTINUE DEBATE] Current messages count:", currentMessages.length)

      const response = await fetch("/api/auto-continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character1: currentCharacters[0],
          character2: currentCharacters[1],
          currentMessages: currentMessages,
          topic: debateTopic,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API returned ${response.status}: ${errorText}`)
      }

      const data = await response.json()

      const newMessages = [
        {
          character: currentCharacters[0],
          content: data.response1,
          timestamp: Date.now(),
        },
        {
          character: currentCharacters[1],
          content: data.response2,
          timestamp: Date.now() + 100,
        },
      ]

      const allMessages = [...currentMessages, ...newMessages]
      setDebateMessages(allMessages)

      setIsProcessing(false)

      // Start playing the first new message
      await playDebateAudio(newMessages[0], allMessages, currentMessages.length)
    } catch (error) {
      console.error("🎯 [CONTINUE DEBATE] Error:", error)
      setAudioError(`Failed to continue debate: ${error.message}`)
      setIsProcessing(false)
      setSpeakerStatus(null)
    }
  }

  // Reset debate
  const resetDebate = () => {
    console.log("🎯 [RESET DEBATE] Resetting debate")
    setIsDebating(false)
    setDebateTopic("")
    setDebateMessages([])
    setCurrentSpeaker(null)
    setSpeakerStatus(null)
    setIsPlaying(false)
    setIsProcessing(false)
    setAudioError(null)
    setSelectedCharacters([])
    setShowTopicSelector(false)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }

  const toggleMode = () => {
    setMode(mode === "question" ? "debate" : "question")
    setSelectedPersona("")
    currentPersonaRef.current = ""
    setSelectedCharacters([])
    setIsListening(false)
    setIsProcessing(false)
    setIsPlaying(false)
    setAudioError(null)
    setThinkingMessage("")
    setIsDebating(false)
    setDebateTopic("")
    setShowTopicSelector(false)
  }

  const handleRecordingButtonClick = useCallback(
    async (characterId, e) => {
      e.stopPropagation()
      console.log("Recording button clicked for character:", characterId)

      if (mode === "question") {
        if (selectedPersona === characterId) {
          // If this character is selected and we're listening, stop recording
          if (isListening) {
            console.log("Stopping recording...")
            stopListening()
          } else if (!isProcessing && !isPlaying) {
            // If not currently doing anything, start recording again
            console.log("Starting new recording...")
            await startListening()
          }
        } else {
          // Select new character and start recording
          console.log("Selecting new character and starting recording...")
          setSelectedPersona(characterId)
          currentPersonaRef.current = characterId
          setSelectedCharacters([characterId])
          await startListening()
        }
      }
    },
    [mode, selectedPersona, isListening, isProcessing, isPlaying, startListening, stopListening],
  )

  // User Interaction Required for Mobile Audio
  const requiresUserInteractionElement = (
    <div className="mb-8 text-center">
      <div className="bg-yellow-800 rounded-lg p-6 inline-block">
        <h2 className="text-xl font-bold text-yellow-400 mb-4">Enable Audio</h2>
        <p className="text-gray-300 mb-4">
          Mobile browsers require user interaction to play audio. Tap the button below to enable audio and start the
          debate.
        </p>
        <button
          onClick={unlockAudioContext}
          className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-lg font-semibold"
        >
          🔊 Enable Audio & Start Debate
        </button>
      </div>
    </div>
  )

  // Debate Display
  const debateDisplayElement = (
    <div className="mb-8 bg-gray-800 rounded-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">Debate in Progress</h2>
        <p className="text-lg text-gray-300">Topic: {debateTopic}</p>
        <p className="text-sm text-gray-400 mt-2">
          {personas[selectedCharacters[0]]?.name} vs {personas[selectedCharacters[1]]?.name}
        </p>
      </div>

      {/* Debate Messages */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {debateMessages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${message.character === selectedCharacters[0] ? "bg-blue-900" : "bg-red-900"}`}
          >
            <div className="flex items-center mb-2">
              <img
                src={personas[message.character]?.image || "/placeholder.svg"}
                alt={personas[message.character]?.name}
                className="w-8 h-8 rounded-full mr-3"
              />
              <span className="font-semibold text-yellow-400">{personas[message.character]?.name}</span>
              {currentSpeaker === message.character && (
                <span className="ml-2 text-xs text-gray-400">
                  {speakerStatus === "thinking" ? "Thinking..." : speakerStatus === "speaking" ? "Speaking..." : ""}
                </span>
              )}
            </div>
            <p className="text-gray-100">{message.content}</p>
          </div>
        ))}
      </div>

      {/* Debate Controls */}
      <div className="mt-6 text-center">
        <button onClick={handleDebateEnd} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg">
          End Debate
        </button>
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 text-white">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Heroes of History
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Engage in conversations and debates with history's greatest minds
            </p>

            {/* Mode Toggle */}
            <div className="flex justify-center mb-8">
              <div className="bg-gray-800 rounded-full p-1 flex">
                <button
                  onClick={toggleMode}
                  className={`px-6 py-3 rounded-full transition-all duration-300 ${
                    mode === "question" ? "bg-yellow-500 text-black font-semibold" : "text-gray-300 hover:text-white"
                  }`}
                >
                  Ask Questions
                </button>
                <button
                  onClick={toggleMode}
                  className={`px-6 py-3 rounded-full transition-all duration-300 ${
                    mode === "debate" ? "bg-yellow-500 text-black font-semibold" : "text-gray-300 hover:text-white"
                  }`}
                >
                  Watch Debates
                </button>
              </div>
            </div>
          </div>

          {isLoadingVoices && (
            <div className="mb-8 p-4 bg-yellow-800 text-yellow-100 rounded-lg text-center">
              <div className="inline-block animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full mr-2"></div>
              Loading voice data... Please wait.
            </div>
          )}

          {/* Instructions */}
          <div className="text-center mb-8">
            {mode === "debate" && selectedCharacters.length < 2 && (
              <p className="text-lg text-gray-300">
                Select two historical figures to watch them debate fascinating topics
              </p>
            )}
          </div>

          {/* Character Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-12">
            {Object.entries(personas).map(([key, persona]) => {
              const isSelected = mode === "question" ? selectedPersona === key : selectedCharacters.includes(key)
              const shouldGrayOut = shouldGrayOutCharacter(key)
              const isCurrentDebateSpeaker = currentSpeaker === key

              return (
                <div
                  key={key}
                  className={`relative group cursor-pointer transform transition-all duration-300 hover:scale-105 ${
                    isSelected ? "ring-4 ring-yellow-400" : ""
                  } ${shouldGrayOut ? "opacity-30" : ""} ${
                    isCurrentDebateSpeaker && isDebating ? "ring-4 ring-blue-400" : ""
                  }`}
                >
                  <div className="bg-gray-800 rounded-xl overflow-hidden shadow-2xl aspect-square relative">
                    <div className="h-2/3">
                      <img
                        src={persona.image || "/placeholder.svg"}
                        alt={persona.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />

                      {/* Speaking animation overlay */}
                      {isCurrentDebateSpeaker && speakerStatus === "speaking" && (
                        <div className="absolute inset-0 bg-yellow-400 bg-opacity-20 animate-pulse"></div>
                      )}

                      {/* Thinking animation overlay */}
                      {isCurrentDebateSpeaker && speakerStatus === "thinking" && (
                        <div className="absolute inset-0 bg-blue-400 bg-opacity-20 flex items-center justify-center">
                          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 h-1/3 flex flex-col justify-between">
                      <h3 className="text-sm font-bold text-yellow-400 truncate">{persona.name}</h3>

                      {/* Status indicator for debates */}
                      {isDebating && isCurrentDebateSpeaker && (
                        <p className="text-xs text-center mb-1">
                          {speakerStatus === "thinking"
                            ? "Thinking..."
                            : speakerStatus === "speaking"
                              ? "Speaking..."
                              : "Waiting..."}
                        </p>
                      )}

                      {/* Dynamic Button */}
                      <div className="mt-2 flex space-x-1">
                        {mode === "question" ? (
                          <>
                            <button
                              onClick={(e) => handleRecordingButtonClick(key, e)}
                              disabled={shouldGrayOut}
                              className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all duration-300 flex items-center justify-center space-x-1 ${getButtonColor(key)} ${
                                shouldGrayOut ? "bg-gray-600 text-gray-400 cursor-not-allowed" : ""
                              }`}
                            >
                              <SmallMicIcon isActive={selectedPersona === key && isListening} />
                              <span className="truncate">{getStatusText(key)}</span>
                            </button>

                            {/* Pause/Resume/Stop buttons when playing */}
                            {selectedPersona === key && isPlaying && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    pauseAudio()
                                  }}
                                  className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                                  title="Pause"
                                >
                                  ⏸
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    stopAudio()
                                  }}
                                  className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                                  title="Stop"
                                >
                                  ⏹
                                </button>
                              </>
                            )}

                            {/* Resume button when paused */}
                            {selectedPersona === key &&
                              !isPlaying &&
                              audioRef.current &&
                              audioRef.current.currentTime > 0 &&
                              !audioRef.current.ended && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    resumeAudio()
                                  }}
                                  className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  title="Resume"
                                >
                                  ▶
                                </button>
                              )}
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCharacterSelect(key)
                            }}
                            disabled={isDebating}
                            className={`w-full py-1 px-2 rounded text-xs font-semibold transition-all duration-300 ${
                              selectedCharacters.includes(key)
                                ? "bg-yellow-500 text-black"
                                : selectedCharacters.length >= 2
                                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                  : isDebating
                                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-700 text-white hover:bg-gray-600"
                            }`}
                          >
                            {selectedCharacters.includes(key)
                              ? "Selected"
                              : selectedCharacters.length >= 2
                                ? "Max 2"
                                : isDebating
                                  ? "Debating"
                                  : "Select"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Audio Error Display */}
          {audioError && <div className="mb-8 p-4 bg-red-900 text-red-100 rounded-lg text-center">{audioError}</div>}

          {/* Dynamic Content Area */}
          {showTopicSelector && selectedCharacters.length === 2 && !isDebating && (
            <EmbeddedTopicSelector
              onSelectTopic={handleTopicSelect}
              character1={selectedCharacters[0]}
              character2={selectedCharacters[1]}
            />
          )}

          {/* User Interaction Required for Mobile Audio */}
          {requiresUserInteraction && requiresUserInteractionElement}

          {/* Debate Display */}
          {isDebating && debateDisplayElement}
        </div>
      </div>
    </Layout>
  )
}
