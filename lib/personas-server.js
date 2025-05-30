// Server-side personas data for API routes
export const personasConfig = {
  daVinci: {
    id: "daVinci",
    name: "Leonardo da Vinci",
    envVarName: "ELEONARDO_VOICE_ID",
    voiceKey: "davinci",
  },
  socrates: {
    id: "socrates",
    name: "Socrates",
    envVarName: "SOCRATES_VOICE_ID",
    voiceKey: "socrates",
  },
  frida: {
    id: "frida",
    name: "Frida Kahlo",
    envVarName: "FRIDA_VOICE_ID",
    voiceKey: "frida",
  },
  shakespeare: {
    id: "shakespeare",
    name: "William Shakespeare",
    envVarName: "SHAKESPEARE_VOICE_ID",
    voiceKey: "shakespeare",
  },
  mozart: {
    id: "mozart",
    name: "Wolfgang Amadeus Mozart",
    envVarName: "MOZART_VOICE_ID",
    voiceKey: "mozart",
  },
}

export function getVoiceIdForPersona(personaId) {
  const persona = personasConfig[personaId]
  if (!persona) return null

  return process.env[persona.envVarName] || null
}

export function getAllVoiceIds() {
  const voiceIds = {}

  Object.values(personasConfig).forEach((persona) => {
    voiceIds[persona.voiceKey] = process.env[persona.envVarName] || null
  })

  return voiceIds
}
