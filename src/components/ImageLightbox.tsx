import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ImageLightboxProps {
    src: string;
    alt?: string;
    open: boolean;
    onClose: () => void;
}

const ImageLightbox = ({ src, alt = "Imagem", open, onClose }: ImageLightboxProps) => {
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    if (!open || !src) return null;

    return createPortal(
        <div
            className="lightbox-overlay"
            onClick={onClose}
        >
            <button
                className="lightbox-close"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Fechar"
            >
                <X className="h-6 w-6" />
            </button>
            <div
                className="lightbox-content"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={src}
                    alt={alt}
                    className="lightbox-image"
                />
                {alt && alt !== "Imagem" && (
                    <p className="lightbox-caption">{alt}</p>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ImageLightbox;
