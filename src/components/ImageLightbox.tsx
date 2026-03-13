import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageLightboxProps {
    src?: string;
    alt?: string;
    open: boolean;
    onClose: () => void;
    images?: { src: string; alt: string }[];
    initialIndex?: number;
}

const ImageLightbox = ({ src, alt = "Imagem", open, onClose, images, initialIndex = 0 }: ImageLightboxProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    const isGallery = images && images.length > 0;
    const currentList = isGallery ? images! : [{ src: src!, alt: alt! }];

    useEffect(() => {
        if (open) {
            setCurrentIndex(initialIndex);
        }
    }, [open, initialIndex]);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (isGallery) {
                if (e.key === "ArrowLeft") {
                    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : currentList.length - 1));
                }
                if (e.key === "ArrowRight") {
                    setCurrentIndex((prev) => (prev < currentList.length - 1 ? prev + 1 : 0));
                }
            }
        };
        document.addEventListener("keydown", handleKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.body.style.overflow = "";
        };
    }, [open, onClose, isGallery, currentList.length]);

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : currentList.length - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev < currentList.length - 1 ? prev + 1 : 0));
    };

    if (!open) return null;

    const currentItem = currentList[currentIndex] || currentList[0];
    if (!currentItem || !currentItem.src) return null;

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

            {isGallery && currentList.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                        aria-label="Anterior"
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 rounded-full p-2 text-white transition-colors z-50 focus:outline-none"
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        aria-label="Próximo"
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 rounded-full p-2 text-white transition-colors z-50 focus:outline-none"
                    >
                        <ChevronRight className="h-8 w-8" />
                    </button>
                </>
            )}

            <div
                className="lightbox-content"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={currentItem.src}
                    alt={currentItem.alt}
                    className="lightbox-image"
                />
                {currentItem.alt && currentItem.alt !== "Imagem" && (
                    <p className="lightbox-caption">{currentItem.alt}</p>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ImageLightbox;
