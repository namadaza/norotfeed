"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCroppedImage, type CroppedImageResult } from "@/lib/crop-image";

type Props = {
  // The photo currently loaded into the cropper. When null, the modal
  // shows nothing (it's about to receive one, or is closed).
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called with the finished, framed square once the user hits Save.
  onCropped: (result: CroppedImageResult) => void;
  // Called when the user picks a brand new photo from inside the modal,
  // so the parent can swap what "file" points to.
  onFileReplaced: (file: File) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.05;

export function ProfileCropModal({
  file,
  open,
  onOpenChange,
  onCropped,
  onFileReplaced,
}: Props) {
  // Object URL for the current file, so react-easy-crop can display it.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // How far the image is dragged from center.
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  // Current zoom level (1 = fit, 3 = 3x in).
  const [zoom, setZoom] = useState(1);
  // The framed rectangle in the source image's real pixels. This is what
  // the export helper needs, and it's the reason quality is preserved.
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hidden input used for the "choose different photo" button inside
  // the modal, separate from the one on the Account page.
  const swapInputRef = useRef<HTMLInputElement>(null);

  // Build a preview URL whenever the file changes (either the initial
  // photo, or a swap from inside the modal), and clean it up after.
  // Resetting zoom/drag means every new photo starts fresh and centered.
  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // react-easy-crop reports the framed area every time the user moves or
  // zooms. We keep only the pixel version, which is in the source image's
  // true coordinate space.
  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function clampZoom(value: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }

  function handleSwapFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;

    if (!picked.type.startsWith("image/")) {
      setError("That file is not an image. Please choose a JPG, PNG, GIF, or WebP.");
      return;
    }

    const maxBytes = 4 * 1024 * 1024;
    if (picked.size > maxBytes) {
      const sizeMb = (picked.size / (1024 * 1024)).toFixed(1);
      setError(`That image is ${sizeMb}MB. Please choose one under 4MB.`);
      return;
    }

    setError(null);
    onFileReplaced(picked);
  }

  async function handleSave() {
    if (!file || !croppedAreaPixels) return;
    setProcessing(true);
    setError(null);
    try {
      const result = await getCroppedImage(file, croppedAreaPixels, {
        outputSize: 512,
      });
      onCropped(result);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That image could not be processed. Please try another.",
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (processing ? null : onOpenChange(next))}>
      <DialogContent
        showCloseButton={false}
        className="flex max-w-md flex-col gap-4 p-4 sm:p-6"
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="font-serif text-lg">Reposition photo</DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={processing}
            onClick={() => swapInputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            Choose different photo
          </Button>
        </div>
        <DialogDescription className="sr-only">
          Drag to move and use the slider to zoom, then save your profile picture. You can
          also choose a different photo from here.
        </DialogDescription>

        <input
          ref={swapInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSwapFile}
        />

        {/* The crop stage. Needs a fixed height and relative positioning
            because react-easy-crop fills its container absolutely. */}
        <div className="relative h-72 w-full overflow-hidden rounded-md bg-muted">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              restrictPosition
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* Zoom control: minus button, range slider, plus button. */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={processing}
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP * 2))}
          >
            <Minus className="size-4" />
          </Button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            aria-label="Zoom"
            disabled={processing}
            onChange={(event) => setZoom(clampZoom(Number(event.target.value)))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={processing}
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP * 2))}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={processing || !croppedAreaPixels}>
            {processing ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}