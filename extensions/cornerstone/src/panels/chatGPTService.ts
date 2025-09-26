import axios from 'axios';

export const generateRadiologyReport = async ({
  html,
  clinicalInfo,
  userInstruction,
  studyUID,
}) => {
  const prompt = `
**Primary Task:** You are a medical assistant. Your primary goal is to generate a professional radiology report. **You MUST format your entire response using Markdown.**

**Formatting Rules (Strict):**
- Use '### ' (with a space) for main headings like '### FINDINGS' and '### IMPRESSION'.
- Ensure each heading is on its own new line.
- Write the content under 'FINDINGS' as a standard paragraph.
- Use a numbered list for the 'IMPRESSION' section (e.g., '1. First point').
- Italicize any final disclaimers by wrapping them in single asterisks (*Disclaimer text*).

**Source Data:**
- Clinical Information: ${clinicalInfo}
- Structured Findings: ${html.replace(/<[^>]*>?/gm, '') || 'No findings available.'}

**User's Optional Instruction:**
- "${userInstruction || 'No specific instruction provided.'}"

**Action:**
1.  Review all source data.
2.  If the user provides an instruction, use it to guide the report's focus.
3.  If the instruction is unclear or missing, IGNORE IT and generate a standard report.
4.  Generate a complete radiology report that strictly follows all the Markdown formatting rules above.
5.  Do not write any text or commentary outside of the formatted report.
`;

  const response = await axios.post('http://localhost:8082/api/chatgpt/fix-grammar', {
    report: html,
    prompt,
  });

  if (response.data?.fixedReport) {
    return response.data.fixedReport;
  } else {
    throw new Error('No valid response from AI');
  }
};
