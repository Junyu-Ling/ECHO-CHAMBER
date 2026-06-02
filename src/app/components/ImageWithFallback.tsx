import React, { useState } from "react";

const ERROR_IMG_SRC =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==";

export function ImageWithFallback({
  showSkeleton = true,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { showSkeleton?: boolean }) {
  const [didError, setDidError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { src, alt, style, className, onLoad, ...rest } = props;

  if (didError) {
    return (
      <div
        className={`inline-block bg-gray-100 text-center align-middle ${className ?? ""}`}
        style={style}
      >
        <div className="flex items-center justify-center w-full h-full">
          <img src={ERROR_IMG_SRC} alt="Error loading image" {...rest} data-original-url={src} />
        </div>
      </div>
    );
  }

  return (
    <>
      {showSkeleton && !loaded && (
        <div
          className={`absolute inset-0 animate-pulse ${className ?? ""}`}
          style={{ background: "linear-gradient(135deg, #0e0e1c 0%, #1a1a2e 50%, #0e0e1c 100%)" }}
          aria-hidden
        />
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.35s ease-out",
        }}
        {...rest}
        decoding="async"
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={() => setDidError(true)}
      />
    </>
  );
}
