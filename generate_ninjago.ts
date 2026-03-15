import { GoogleGenAI } from "@google/genai";
import fs from "fs";

async function generateNinjago() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: 'A cute LEGO Ninja character in Japanese manga/anime style. Vibrant colors, dynamic pose, holding a small katana. High quality, clean lines, white background.',
        },
      ],
    },
    config: {
      imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
        }
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      fs.writeFileSync('ninjago.png', Buffer.from(base64EncodeString, 'base64'));
      console.log('Ninjago image generated successfully.');
    }
  }
}

generateNinjago();
