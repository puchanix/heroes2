"use client"

import { useState, useRef, useEffect } from "react"

export default function EmbeddedTopicSelector({ onSelectTopic, character1, character2 }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioError, setAudioError] = useState(null)
  const [selectedCharacters, setSelectedCharacters] = useState([])
  const [personas, setPersonas] = useState({})

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const selectedCharactersRef = useRef([])

  // Load personas
  useEffect(() => {
    async function loadPersonas() {
      try {
        const personasModule = await import("../lib/personas")
        setPersonas(personasModule.personas)
      } catch (error) {
        console.error("Error loading personas:", error)
      }
    }
    loadPersonas()
  }, [])

  // Update selected characters when props change
  useEffect(() => {
    const chars = [character1, character2].filter(Boolean)
    setSelectedCharacters(chars)
    selectedCharactersRef.current = chars
    console.log("🎤 [CUSTOM TOPIC] Selected characters updated:", chars)
  }, [character1, character2])

  // API connectivity test
  useEffect(() => {
    async function testAPIs() {
      console.log("🔍 [API TEST] Testing API connectivity...")

      try {
        const transcribeTest = await fetch("/api/transcribe", { method: "GET" })
        console.log("🔍 [API TEST] Transcribe API status:", transcribeTest.status)
      } catch (error) {
        console.log("🔍 [API TEST] Transcribe API error:", error.message)
      }

      try {
        const chatTest = await fetch("/api/chat-streaming", { method: "GET" })
        console.log("🔍 [API TEST] Chat API status:", chatTest.status)
      } catch (error) {
        console.log("🔍 [API TEST] Chat API error:", error.message)
      }
    }

    testAPIs()
  }, [])

  const startCustomTopicRecording = async () => {
    try {
      console.log("🎤 [CUSTOM TOPIC] Starting custom topic recording...")
      setAudioError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      console.log("🎤 [CUSTOM TOPIC] Got media stream")
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        console.log("🎤 [CUSTOM TOPIC] Audio chunk received, size:", event.data.size)
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        console.log("🎤 [CUSTOM TOPIC] Recording stopped, processing...")
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        console.log("🎤 [CUSTOM TOPIC] Audio blob created, size:", audioBlob.size)
        await processCustomTopicAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      console.log("🎤 [CUSTOM TOPIC] Recording started")
    } catch (error) {
      console.error("🎤 [CUSTOM TOPIC] Error accessing microphone:", error)
      setAudioError("Could not access microphone. Please check permissions.")
    }
  }

  const stopCustomTopicRecording = () => {
    console.log("🎤 [CUSTOM TOPIC] Stopping custom topic recording...")

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      console.log("🎤 [CUSTOM TOPIC] MediaRecorder stopped")
      setIsRecording(false)
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log("🎤 [CUSTOM TOPIC] Track stopped:", track.kind)
      })
      streamRef.current = null
    }
  }

  const processCustomTopicAudio = async (audioBlob) => {
    console.log("🎤 [CUSTOM TOPIC] Processing custom topic audio...")
    console.log("🎤 [CUSTOM TOPIC] Audio blob size:", audioBlob.size)

    setIsProcessing(true)
    setAudioError(null)

    try {
      // Convert audio to text
      const formData = new FormData()
      formData.append("audio", audioBlob, "custom-topic.wav")

      console.log("🎤 [CUSTOM TOPIC] Sending to transcription API...")
      const transcriptionResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      })

      console.log("🎤 [CUSTOM TOPIC] Transcription response status:", transcriptionResponse.status)

      if (!transcriptionResponse.ok) {
        throw new Error("Failed to transcribe audio")
      }

      const { text } = await transcriptionResponse.json()
      console.log("🎤 [CUSTOM TOPIC] Transcribed text:", text)

      if (!text || text.trim().length === 0) {
        throw new Error("No speech detected. Please try again.")
      }

      // Use the characters from the ref to ensure we have the latest values
      const currentCharacters = selectedCharactersRef.current
      console.log("🎤 [CUSTOM TOPIC] Using characters from ref:", currentCharacters)

      if (currentCharacters.length !== 2) {
        throw new Error("Please select exactly 2 characters for the debate")
      }

      console.log("🎤 [CUSTOM TOPIC] Starting debate with custom topic:", text)
      console.log("🎤 [CUSTOM TOPIC] Using characters:", currentCharacters)

      // Call the parent's topic selection handler
      if (onSelectTopic) {
        onSelectTopic(text)
      }
    } catch (error) {
      console.error("🎤 [CUSTOM TOPIC] Error processing custom topic audio:", error)
      setAudioError(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const predefinedTopics = [
    "The role of art in society",
    "Science vs. spirituality",
    "The nature of true love",
    "What makes a life worth living",
    "The balance between individual freedom and social responsibility",
    "The purpose of education",
    "Whether technology improves or harms humanity",
    "The meaning of justice",
    "The relationship between power and corruption",
    "Whether humans are naturally good or evil",
  ]

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-yellow-400 text-center mb-6">Choose a Debate Topic</h2>

      {selectedCharacters.length === 2 && (
        <div className="text-center mb-6">
          <p className="text-gray-300 mb-2">
            <span className="text-blue-400 font-semibold">{personas[selectedCharacters[0]]?.name}</span>
            {" vs "}
            <span className="text-red-400 font-semibold">{personas[selectedCharacters[1]]?.name}</span>
          </p>
        </div>
      )}

      {/* Custom Topic Recording */}
      <div className="mb-8 p-4 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-300 mb-4 text-center">Record Your Own Topic</h3>

        <div className="text-center">
          <button
            onClick={isRecording ? stopCustomTopicRecording : startCustomTopicRecording}
            disabled={isProcessing}
            className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                : isProcessing
                  ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {isRecording ? "🎤 Stop Recording" : isProcessing ? "Processing..." : "🎤 Record Topic"}
          </button>

          <p className="text-gray-400 text-sm mt-2">
            {isRecording ? "Speak your debate topic clearly..." : "Click to record a custom debate topic"}
          </p>
        </div>

        {audioError && <div className="mt-4 p-3 bg-red-900 text-red-100 rounded text-center">{audioError}</div>}
      </div>

      {/* Predefined Topics */}
      <div>
        <h3 className="text-lg font-semibold text-yellow-300 mb-4 text-center">Or Choose a Predefined Topic</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {predefinedTopics.map((topic, index) => (
            <button
              key={index}
              onClick={() => onSelectTopic && onSelectTopic(topic)}
              className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-300 text-left hover:scale-105"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
