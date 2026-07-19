const DISCORD_API = "https://discord.com/api/v10";

// El comando que ve el usuario en Discord. type 1 = CHAT_INPUT (slash),
// option type 3 = STRING. El max_length hereda el límite de /chat.
export const ASK_COMMAND = {
  name: "ask",
  description: "Ask the documentation — answers cite their sources",
  type: 1,
  options: [
    {
      type: 3,
      name: "question",
      description: "Your question",
      required: true,
      max_length: 2000,
    },
  ],
};

// Registro (idempotente) del comando global al arrancar, solo si el bot está
// configurado. PUT reemplaza TODOS los comandos globales de la aplicación:
// se asume una app de Discord dedicada a Docsera, y así los renombrados o
// borrados futuros no dejan comandos huérfanos.
export async function registerDiscordCommands(): Promise<void> {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!applicationId || !botToken) return;

  try {
    const res = await fetch(`${DISCORD_API}/applications/${applicationId}/commands`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify([ASK_COMMAND]),
    });
    if (!res.ok) {
      console.error(`No se pudo registrar el comando /ask en Discord (HTTP ${res.status})`);
      return;
    }
    console.log("Discord: comando /ask registrado");
  } catch (error) {
    // El registro no puede tumbar el arranque: el server sigue sirviendo el
    // resto de superficies y el registro se reintenta en el próximo boot.
    console.error("No se pudo registrar el comando /ask en Discord:", error);
  }
}
