import { useMemo } from "react";

interface AnimatedBackgroundProps {
    variant?: "vibrant" | "subtle";
}

interface FloatingItem {
    id: number;
    icon: string;
    size: number;
    left: string;
    top: string;
    animClass: string;
    delay: string;
    opacity: number;
}

const ICONS_VIBRANT = ["📚", "⭐", "✏️", "📖", "🎨", "🦋", "🌟", "📝", "🔖", "💡", "🎈", "❤️", "🌈", "🧸", "📕"];
const ICONS_SUBTLE = ["📚", "⭐", "📖", "🔖", "💡", "📝", "📕"];

const ANIM_CLASSES = [
    "animate-bg-float-1",
    "animate-bg-float-2",
    "animate-bg-float-3",
    "animate-bg-float-4",
    "animate-bg-float-5",
];

const AnimatedBackground = ({ variant = "vibrant" }: AnimatedBackgroundProps) => {
    const isSubtle = variant === "subtle";
    const count = isSubtle ? 12 : 20;
    const icons = isSubtle ? ICONS_SUBTLE : ICONS_VIBRANT;

    const items: FloatingItem[] = useMemo(() => {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            icon: icons[i % icons.length],
            size: isSubtle ? 14 + (i % 4) * 4 : 24 + (i % 5) * 8,
            left: `${(i * 37 + 13) % 100}%`,
            top: `${(i * 29 + 7) % 100}%`,
            animClass: ANIM_CLASSES[i % ANIM_CLASSES.length],
            delay: `${(i * 1.3) % 8}s`,
            opacity: isSubtle ? 0.04 + (i % 3) * 0.02 : 0.15 + (i % 4) * 0.05,
        }));
    }, [isSubtle, count, icons]);

    return (
        <div className="animated-bg-container" aria-hidden="true">
            {/* Gradient overlay */}
            <div
                className={`animated-bg-gradient ${isSubtle ? "animated-bg-gradient-subtle" : "animated-bg-gradient-vibrant"
                    }`}
            />

            {/* Floating shapes - SVG circles */}
            <svg className="animated-bg-shapes" viewBox="0 0 1440 900" preserveAspectRatio="none">
                <circle
                    cx="200" cy="150" r={isSubtle ? 80 : 120}
                    className={`animated-bg-circle-1 ${isSubtle ? "animated-bg-circle-subtle" : "animated-bg-circle-vibrant"}`}
                />
                <circle
                    cx="1200" cy="700" r={isSubtle ? 60 : 100}
                    className={`animated-bg-circle-2 ${isSubtle ? "animated-bg-circle-subtle" : "animated-bg-circle-vibrant"}`}
                />
                <circle
                    cx="700" cy="400" r={isSubtle ? 40 : 70}
                    className={`animated-bg-circle-3 ${isSubtle ? "animated-bg-circle-subtle" : "animated-bg-circle-vibrant"}`}
                />
            </svg>

            {/* Floating emoji icons */}
            {items.map((item) => (
                <span
                    key={item.id}
                    className={`animated-bg-icon ${item.animClass}`}
                    style={{
                        left: item.left,
                        top: item.top,
                        fontSize: `${item.size}px`,
                        animationDelay: item.delay,
                        opacity: item.opacity,
                    }}
                >
                    {item.icon}
                </span>
            ))}
        </div>
    );
};

export default AnimatedBackground;
