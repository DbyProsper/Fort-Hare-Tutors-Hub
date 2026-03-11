import React, { useState } from 'react';
import { Play } from 'lucide-react';

const TutorSystemStoryVideo = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              The Story Behind the Tutor Application System
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover how this innovative platform was conceived and developed to revolutionize
              tutor recruitment and streamline the application process at the University of Fort Hare.
            </p>
          </div>

          <div className="relative max-w-3xl mx-auto">
            <div className="aspect-video rounded-lg shadow-lg overflow-hidden bg-black">
              <video
                className="w-full h-full object-cover"
                controls
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                <source src="/UFHTutorStory.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {!isPlaying && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer"
                  onClick={handlePlay}
                >
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors">
                    <Play className="w-8 h-8 text-primary ml-1" fill="currentColor" />
                  </div>
                </div>
              )}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-4">
              This short video explains how the Tutor Application System was conceived and developed
              to improve the tutor recruitment process at the University of Fort Hare.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TutorSystemStoryVideo;