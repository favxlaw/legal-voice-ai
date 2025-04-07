import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, data } = await req.json()

  // Extract any attachments from the data
  const attachments = data?.attachments || []

  // Process the attachments
  let fileContents = ""
  let fileNames: string[] = []

  if (attachments.length > 0) {
    // In a real application, you would process different file types differently
    // For now, we'll just collect the file names and acknowledge them
    fileNames = attachments.map((attachment: any) => attachment.name)

    // You could extract text from PDFs, analyze images, etc.
    // For this example, we'll just note that we received the files
    fileContents = `The user has uploaded the following files: ${fileNames.join(", ")}. `
  }

  let systemPrompt = "You are an AI assistant specialized in document analysis. Be helpful, clear, and concise."

  if (attachments.length > 0) {
    systemPrompt += ` The user has attached the following files: ${fileNames.join(", ")}. `
    systemPrompt += "Acknowledge the files and offer to analyze them based on their types. "
    systemPrompt += "For PDFs, DOC, DOCX, and TXT files, offer to analyze the text content. "
    systemPrompt += "For images (JPG, JPEG, PNG), offer to describe what's in the image. "
    systemPrompt += "For spreadsheets (CSV, XLSX, XLS), offer to analyze the data. "
    systemPrompt += "For presentations (PPT, PPTX), offer to review the slides."
  }

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    system: systemPrompt,
  })

  return result.toDataStreamResponse()
}

