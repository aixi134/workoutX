import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_EQUIPMENT_VOCABULARY } from "@/lib/exercises/normalizer";
import { getEquipmentVocabulary } from "@/lib/exercises/service";
import { getAIProvider } from "@/lib/ai/provider";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ValidationError", message: "请上传 image 文件。" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "ValidationError", message: "图片不能超过 8MB。" }, { status: 400 });
    }

    const mimeType = file.type || "image/jpeg";
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(mimeType)) {
      return NextResponse.json({ error: "ValidationError", message: "仅支持 PNG、JPEG、WEBP 或非动画 GIF。" }, { status: 400 });
    }

    const equipmentVocabulary = await loadEquipmentVocabulary();
    const provider = getAIProvider();
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const result = await provider.recognizeEquipment({ imageBuffer, mimeType, equipmentVocabulary });

    const recognition = await prisma.equipmentRecognition.create({
      data: {
        provider: result.provider,
        model: result.model,
        candidates: result.candidates,
        rawOutput: result.rawOutput ?? {},
      },
    });

    return NextResponse.json({ ...result, id: recognition.id });
  } catch (error) {
    return jsonError(error);
  }
}

async function loadEquipmentVocabulary() {
  try {
    const result = await getEquipmentVocabulary();
    return result.equipment;
  } catch {
    return DEFAULT_EQUIPMENT_VOCABULARY;
  }
}
