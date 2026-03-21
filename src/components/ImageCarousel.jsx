import { useState, useCallback } from 'react';
import { PLACEHOLDER_IMAGE } from '../lib/constants';

export default function ImageCarousel({ images = [], thumbnail, alt = 'Property', size = 'card' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageError, setImageError] = useState({});

  const allImages = images.length > 0
    ? images
    : thumbnail
    ? [{ url: thumbnail }]
    : [];

  const hasImages = allImages.length > 0;
  const hasMultiple = allImages.length > 1;

  const goNext = useCallback((e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % allImages.length);
  }, [allImages.length]);

  const goPrev = useCallback((e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  }, [allImages.length]);

  const handleError = useCallback((index) => {
    setImageError((prev) => ({ ...prev, [index]: true }));
  }, []);

  const currentImage = hasImages ? allImages[currentIndex] : null;
  const currentUrl = currentImage && !imageError[currentIndex]
    ? currentImage.url
    : PLACEHOLDER_IMAGE;

  return (
    <div className={`image-carousel ${size}`}>
      <div className="carousel-image-wrapper">
        <img
          src={currentUrl}
          alt={alt}
          loading="lazy"
          onError={() => handleError(currentIndex)}
          className="carousel-image"
        />

        {!hasImages && (
          <div className="carousel-no-image">
            <span>No photos available</span>
          </div>
        )}
      </div>

      {hasMultiple && (
        <>
          <button className="carousel-btn carousel-prev" onClick={goPrev} aria-label="Previous image">
            ‹
          </button>
          <button className="carousel-btn carousel-next" onClick={goNext} aria-label="Next image">
            ›
          </button>
          <div className="carousel-dots">
            {allImages.slice(0, 8).map((_, i) => (
              <button
                key={i}
                className={`carousel-dot ${i === currentIndex ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                aria-label={`Image ${i + 1}`}
              />
            ))}
            {allImages.length > 8 && (
              <span className="carousel-more">+{allImages.length - 8}</span>
            )}
          </div>
        </>
      )}

      {hasImages && (
        <div className="carousel-count">
          {currentIndex + 1} / {allImages.length}
        </div>
      )}
    </div>
  );
}
