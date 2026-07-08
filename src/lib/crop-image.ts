/**
 * Image crop + export helper.
 *
 * Takes the crop rectangle that react-easy-crop reports (in the SOURCE
 * image's own pixel space) and produces a high-quality square File ready
 * to upload. Built to preserve as much resolution as the source allows,
 * handle phone-photo orientation quirks, and support rotation.
 */

// The crop rectangle react-easy-crop hands back via onCropComplete's
// `croppedAreaPixels`. These are already in the source image's natural
// pixel coordinates, which is what makes full-resolution export possible.
export type CropAreaPixels = {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  export type CroppedImageResult = {
    file: File;
    // A blob URL for instant local preview. Caller MUST revoke it when done
    // (e.g. on unmount or after upload) to avoid a memory leak.
    previewUrl: string;
    width: number;
    height: number;
  };
  
  type ExportOptions = {
    // Rotation in degrees, matching react-easy-crop's `rotation` value.
    rotation?: number;
    // Target square size in px. Larger = crisper when displayed big.
    // The export never upscales past what the crop actually contains.
    outputSize?: number;
    fileName?: string;
    // JPEG/WebP quality, 0..1. Ignored for PNG.
    quality?: number;
    // Force a format. Defaults to auto: PNG if the source has transparency,
    // otherwise JPEG (smaller for photos).
    mimeType?: "image/jpeg" | "image/png" | "image/webp";
  };
  
  const DEFAULT_OUTPUT_SIZE = 512;
  const DEFAULT_QUALITY = 0.92;
  
  /** Loads an image URL into a decoded <img> element. */
  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      // Allows canvas export when the source is a blob/object URL.
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("The image could not be loaded. It may be corrupted."));
      image.src = url;
    });
  }
  
  /**
   * Reads a File into an HTMLImageElement while respecting EXIF orientation.
   *
   * createImageBitmap with imageOrientation:"from-image" bakes the phone's
   * rotation flag into the pixels, so a photo shot sideways comes out upright.
   * We then paint that bitmap onto a canvas and hand back an <img> of the
   * corrected result. If the browser lacks that option we fall back to the
   * raw image (most modern browsers auto-apply orientation for object URLs).
   */
  async function loadOrientedImage(
    file: File,
  ): Promise<{ image: HTMLImageElement; hasAlpha: boolean }> {
    const hasAlpha = file.type === "image/png" || file.type === "image/webp";
  
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
  
        const url = canvas.toDataURL(hasAlpha ? "image/png" : "image/jpeg");
        const image = await loadImage(url);
        return { image, hasAlpha };
      } catch {
        // Fall through to the plain path below.
      }
    }
  
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(objectUrl);
      return { image, hasAlpha };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  
  /** Fills a canvas with a solid color, used to flatten transparency for JPEG. */
  function fillBackground(ctx: CanvasRenderingContext2D, size: number) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
  }
  
  /**
   * Crops `file` to `cropArea`, applies optional rotation, resizes to a fixed
   * square, and returns a File plus a preview URL.
   *
   * Resolution note: the output side length is min(requested size, actual crop
   * size). We never invent pixels by upscaling, but we keep every real pixel
   * the crop contains up to the requested size, which is what "don't compromise
   * size" means in practice.
   */
  export async function getCroppedImage(
    file: File,
    cropArea: CropAreaPixels,
    options: ExportOptions = {},
  ): Promise<CroppedImageResult> {
    const {
      rotation = 0,
      outputSize = DEFAULT_OUTPUT_SIZE,
      fileName,
      quality = DEFAULT_QUALITY,
      mimeType,
    } = options;
  
    if (cropArea.width <= 0 || cropArea.height <= 0) {
      throw new Error("The crop area is empty. Please adjust and try again.");
    }
  
    const { image, hasAlpha } = await loadOrientedImage(file);
  
    // Choose output format. PNG preserves transparency; JPEG is smaller for
    // photos; caller can force WebP if they want the best size/quality mix.
    const outputMime = mimeType ?? (hasAlpha ? "image/png" : "image/jpeg");
    const isJpeg = outputMime === "image/jpeg";
  
    // Cap the export at the real resolution of the crop so we never upscale,
    // but honor a smaller requested size for consistent avatars.
    const targetSize = Math.max(
      1,
      Math.min(outputSize, Math.round(Math.min(cropArea.width, cropArea.height))),
    );
  
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
  
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Your browser could not process the image.");
    }
  
    // Best-quality resampling for the downscale.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  
    // JPEG has no transparency, so flatten onto white first to avoid black.
    if (isJpeg) {
      fillBackground(ctx, targetSize);
    }
  
    if (rotation % 360 !== 0) {
      // Rotate around the canvas center, then draw the crop offset so the
      // selected region lands centered. Mirrors react-easy-crop's math.
      const radians = (rotation * Math.PI) / 180;
      ctx.save();
      ctx.translate(targetSize / 2, targetSize / 2);
      ctx.rotate(radians);
      const scaleX = targetSize / cropArea.width;
      const scaleY = targetSize / cropArea.height;
      ctx.scale(scaleX, scaleY);
      ctx.translate(
        -(cropArea.x + cropArea.width / 2),
        -(cropArea.y + cropArea.height / 2),
      );
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    } else {
      // Straight crop: copy the source rectangle into the full output square.
      ctx.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        targetSize,
        targetSize,
      );
    }
  
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputMime, isJpeg ? quality : undefined);
    });
  
    if (!blob) {
      throw new Error("The cropped image could not be saved. Please try again.");
    }
  
    const extension =
      outputMime === "image/png" ? "png" : outputMime === "image/webp" ? "webp" : "jpg";
    const name = fileName ?? `profile-picture.${extension}`;
  
    const outFile = new File([blob], name, { type: outputMime });
    const previewUrl = URL.createObjectURL(blob);
  
    return { file: outFile, previewUrl, width: targetSize, height: targetSize };
  }