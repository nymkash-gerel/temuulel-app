import { jsonCompletion, isOpenAIConfigured } from './openai-client'
import type { ComplaintSummaryInput, ComplaintSummaryOutput } from './types'

const SYSTEM_PROMPT = `Та монгол хэлний гомдлын мессежийг шинжлэх мэргэжилтэн.
Хэрэглэгчийн гомдлыг JSON форматаар нэгтгэн гаргана уу.

JSON format:
{
  "summary": "1-2 өгүүлбэрээр товч нэгтгэл",
  "main_issues": ["асуудал 1", "асуудал 2"],
  "sentiment": "angry" | "frustrated" | "neutral",
  "action_hint": "менежерт хийх үйлдлийн зөвлөгөө"
}

Зөвхөн өгөгдсөн мессежинд байгаа мэдээлэлд тулгуурлана. Шинэ мэдээлэл зохиож болохгүй.`

export async function summarizeComplaint(
  input: ComplaintSummaryInput
): Promise<ComplaintSummaryOutput | null> {
  if (!isOpenAIConfigured()) return null
  if (!input.complaint_text.trim()) return null

  try {
    const result = await jsonCompletion<ComplaintSummaryOutput>({
      systemPrompt: SYSTEM_PROMPT,
      userContent: input.complaint_text,
      maxTokens: 300,
    })
    return result.data
  } catch (error) {
    console.error('[complaint-summarizer] Failed:', error)
    return null
  }
}
