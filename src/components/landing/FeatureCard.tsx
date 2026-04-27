import type { LucideIcon } from "lucide-react";

type FeatureCardProps = {
    title: string;
    description: string;
    icon: LucideIcon;
    iconClassName?: string;
    id?: string;
};

export function FeatureCard({
    title,
    description,
    icon: Icon,
    iconClassName = "text-[#166534]",
    id,
}: FeatureCardProps) {
    return (
        <article
            id={id}
            className={
                (id ? "scroll-mt-28 " : "") +
                "flex flex-col rounded-[1.25rem] border border-zinc-100/80 bg-white p-7 shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:p-8 md:rounded-2xl"
            }
        >
            <div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ecfdf5] md:h-14 md:w-14 md:rounded-2xl"
                aria-hidden
            >
                <Icon className={`h-6 w-6 md:h-7 md:w-7 ${iconClassName}`} strokeWidth={2} />
            </div>
            <h3 className="mt-5 text-lg font-bold tracking-tight text-zinc-950 md:mt-6 md:text-xl">
                {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 md:mt-3 md:text-base">
                {description}
            </p>
        </article>
    );
}
