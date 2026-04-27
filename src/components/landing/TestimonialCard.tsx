import Image from "next/image";

type TestimonialCardProps = {
    quote: string;
    name: string;
    detail: string;
    imageSrc: string;
    imageAlt: string;
};

export function TestimonialCard({
    quote,
    name,
    detail,
    imageSrc,
    imageAlt,
}: TestimonialCardProps) {
    return (
        <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0f3d2a]/60 p-6 shadow-inner backdrop-blur-sm md:p-8">
            <p className="text-base font-medium leading-relaxed text-white/95 md:text-lg">
                &ldquo;{quote}&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3 md:mt-8">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20 md:h-12 md:w-12">
                    <Image
                        src={imageSrc}
                        alt={imageAlt}
                        fill
                        className="object-cover"
                        sizes="48px"
                    />
                </div>
                <div>
                    <p className="text-sm font-semibold text-white md:text-base">{name}</p>
                    <p className="text-xs text-white/70 md:text-sm">{detail}</p>
                </div>
            </div>
        </article>
    );
}
