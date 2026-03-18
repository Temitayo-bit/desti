import type { ComponentPropsWithoutRef } from "react";

type LogoSize = "sm" | "md" | "lg";

const sizeClasses: Record<
    LogoSize,
    {
        container: string;
        icon: string;
        text: string;
    }
> = {
    sm: {
        container: "gap-2.5",
        icon: "h-9 w-9",
        text: "text-xl",
    },
    md: {
        container: "gap-3",
        icon: "h-11 w-11",
        text: "text-2xl",
    },
    lg: {
        container: "gap-3.5",
        icon: "h-12 w-12",
        text: "text-3xl",
    },
};

function DestiMark({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 96 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden="true"
        >
            <path
                d="M51 14c-7.8 0-14 6.2-14 13.8 0 9.4 12.2 24.9 14 27.2 1.8-2.3 14-17.8 14-27.2C65 20.2 58.8 14 51 14Z"
                fill="currentColor"
            />
            <circle cx="51" cy="28" r="5.7" fill="white" />
            <path
                d="M25 47c6.7-8.1 17-11.9 29.6-6.8 14 5.6 18.8 17.2 12.6 28.7-3 5.6-8.2 10.2-14.7 13.3"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M24 50c6.5 8.7 20.8 11.5 31.9 10.9 8.8-.5 18.8 3.1 24.1 10.2"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M25 47c6.7-8.1 17-11.9 29.6-6.8 14 5.6 18.8 17.2 12.6 28.7-3 5.6-8.2 10.2-14.7 13.3"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="10 8"
            />
            <path
                d="M24 50c6.5 8.7 20.8 11.5 31.9 10.9 8.8-.5 18.8 3.1 24.1 10.2"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="10 8"
            />
            <path
                d="M82 34.5 84.8 41l6.2 2.8-6.2 2.8L82 53l-2.8-6.4-6.2-2.8 6.2-2.8L82 34.5Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function DestiLogo({
    size = "md",
    className = "",
    ...props
}: { size?: LogoSize; className?: string } & ComponentPropsWithoutRef<"span">) {
    const classes = sizeClasses[size];

    return (
        <span
            className={`inline-flex items-center ${classes.container} text-zinc-950 ${className}`.trim()}
            {...props}
        >
            <DestiMark className={`${classes.icon} shrink-0`} />
            <span className={`${classes.text} font-black tracking-tight text-zinc-950`}>
                Desti
            </span>
        </span>
    );
}
