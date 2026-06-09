import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { GET_FEATURED_GALLERY_MEDIA, GET_GALLERY_MEDIA } from '../../graphql/queries';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface GalleryMedia {
  id: string;
  title: string;
  mediaUrl: string;
  mediaType: string;
  thumbnailUrl?: string;
  userName?: string;
}

const GallerySlideshow = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const { data: featuredData, loading: featuredLoading } = useQuery(GET_FEATURED_GALLERY_MEDIA);
  const { data: allData, loading: allLoading } = useQuery(GET_GALLERY_MEDIA, {
    variables: { approvedOnly: true },
  });

  // Use featured media if available, otherwise fall back to all approved media
  const featured: GalleryMedia[] = featuredData?.featuredGalleryMedia || [];
  const approved: GalleryMedia[] = allData?.galleryMedia || [];
  const media = featured.length > 0 ? featured : approved;
  const loading = featuredLoading || allLoading;

  useEffect(() => {
    if (!isAutoPlaying || media.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % media.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [isAutoPlaying, media.length]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-gradient-to-br from-[#1a0903]/50 to-[#0b0505]/50 rounded-[32px]">
        <div className="text-gray-400">Loading gallery...</div>
      </div>
    );
  }

  if (!media || media.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-gradient-to-br from-[#1a0903]/50 to-[#0b0505]/50 rounded-[32px] border border-white/10">
        <div className="text-center space-y-4">
          <p className="text-xl text-gray-400">No featured moments yet</p>
          <p className="text-sm text-gray-500">
            Be the first to share your unforgettable moments
          </p>
        </div>
      </div>
    );
  }

  const currentMedia = media[currentIndex];

  return (
    <div className="relative group">
      {/* Slideshow Container */}
      <div className="relative h-[500px] lg:h-[600px] rounded-[32px] overflow-hidden border border-white/10">
        {/* Media Display */}
        {currentMedia.mediaType === 'video' ? (
          <div className="relative w-full h-full">
            <video
              key={currentMedia.id}
              src={currentMedia.mediaUrl}
              className="w-full h-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-20 h-20 text-white/80" />
            </div>
          </div>
        ) : (
          <img
            key={currentMedia.id}
            src={currentMedia.mediaUrl}
            alt={currentMedia.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Media Info */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <h3 className="text-2xl md:text-3xl font-bold mb-2">{currentMedia.title}</h3>
          {currentMedia.userName && (
            <p className="text-sm md:text-base text-gray-300">
              Captured by {currentMedia.userName}
            </p>
          )}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Indicators */}
        <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-2">
          {media.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setIsAutoPlaying(false);
              }}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-8 bg-white'
                  : 'w-2 bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      </div>

      {/* View All Link */}
      <div className="mt-6 text-center">
        <a
          href="/gallery"
          className="inline-block px-8 py-3 bg-gradient-to-r from-orange-500 to-[#FF6B35] rounded-full font-bold uppercase tracking-wider text-white hover:scale-105 transition-transform"
        >
          View Full Gallery
        </a>
      </div>
    </div>
  );
};

export default GallerySlideshow;
