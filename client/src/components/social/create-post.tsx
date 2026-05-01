import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AppConfigResponse } from "@/lib/types";

interface CreatePostProps {
  onCreatePost: (content: string, contentType: string, imageUrl: string | undefined, videoUrl: string | undefined, language: string) => Promise<void>;
}

export default function CreatePost({ onCreatePost }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("text");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("en");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { data: config } = useQuery<AppConfigResponse>({
    queryKey: ["/api/config"],
  });

  const textCharLimit = config?.content?.textCharLimit ?? 500;
  const maxImageBytes = config?.uploads?.maxImageBytes ?? 2 * 1024 * 1024;
  const maxVideoBytes = (config as any)?.uploads?.maxVideoBytes ?? 25 * 1024 * 1024;

  const uploadImageIfNeeded = async (): Promise<string | undefined> => {
    if (!imageFile) return imageUrl || undefined;

    const token = localStorage.getItem("auth_token");
    const form = new FormData();
    form.append("image", imageFile);

    const res = await fetch("/api/uploads/images", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Image upload failed");
    }

    const json = await res.json();
    const data = json?.data ?? json; // supports envelope
    return data?.url;
  };

  const uploadVideoIfNeeded = async (): Promise<string | undefined> => {
    if (!videoFile) return videoUrl || undefined;

    const token = localStorage.getItem("auth_token");
    const form = new FormData();
    form.append("video", videoFile);

    const res = await fetch("/api/uploads/videos", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Video upload failed");
    }

    const json = await res.json();
    const data = json?.data ?? json; // supports envelope
    return data?.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (content.length > textCharLimit) return;

    setIsSubmitting(true);
    try {
      const uploadedImageUrl = contentType === "image" ? await uploadImageIfNeeded() : undefined;
      const uploadedVideoUrl = contentType === "video" ? await uploadVideoIfNeeded() : undefined;
      await onCreatePost(content, contentType, uploadedImageUrl, uploadedVideoUrl, language);
      setContent("");
      setImageUrl("");
      setImageFile(null);
      setVideoUrl("");
      setVideoFile(null);
      setContentType("text");
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to create post. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const examplePosts = [
    {
      label: "Safe Content",
      text: "Just had an amazing lunch at the new restaurant downtown! The food was incredible and the service was perfect. Highly recommend! 🍕✨",
      type: "safe",
    },
    {
      label: "Potentially Flagged",
      text: "This is such stupid weather today, I hate it so much! Everything is going wrong and I'm so frustrated with this terrible day.",
      type: "warning",
    },
    {
      label: "Likely Blocked",
      text: "I hate everyone and want them to disappear forever! This world is terrible and I wish bad things would happen to all these idiots.",
      type: "danger",
    },
    {
      label: "Hindi Example",
      text: "यह बहुत अच्छा है! मुझे यह जगह बहुत पसंद आई। (This is very good! I really liked this place.)",
      type: "multilingual",
    },
    {
      label: "Spam Pattern",
      text: "BUY NOW! CLICK HERE for amazing deals! Limited time offer! Get rich quick! FREE MONEY! Act fast before this incredible opportunity expires!",
      type: "spam",
    },
  ];

  const useExample = (text: string) => {
    setContent(text);
    // Detect language
    const hasHindi = /[\u0900-\u097F]/.test(text);
    if (hasHindi) {
      setLanguage("hi");
    } else {
      setLanguage("en");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="content-type">Content Type</Label>
            <Select value={contentType} onValueChange={(v) => {
              setContentType(v);
              if (v !== "image") {
                setImageFile(null);
                setImageUrl("");
              }
              if (v !== "video") {
                setVideoFile(null);
                setVideoUrl("");
              }
            }}>
              <SelectTrigger data-testid="select-content-type">
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Post</SelectItem>
                <SelectItem value="image">Image Post</SelectItem>
                <SelectItem value="video">Video Post</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="language">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger data-testid="select-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="ta">Tamil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {contentType === "image" && (
          <div>
            <Label htmlFor="image-file">Image Upload (JPG/PNG/WEBP)</Label>
            <Input
              id="image-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setImageFile(f);
                if (f) setImageUrl("");
              }}
              data-testid="input-image-file"
            />
            <p className="text-sm text-gray-500 mt-1">
              Max size: {Math.round(maxImageBytes / 1024 / 1024)}MB. Or use an Image URL below.
            </p>

            <div className="mt-3">
              <Label htmlFor="image-url">Image URL (Optional)</Label>
              <Input
                id="image-url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value) setImageFile(null);
                }}
                data-testid="input-image-url"
              />
            </div>
          </div>
        )}

        {contentType === "video" && (
          <div>
            <Label htmlFor="video-file">Video Upload (MP4/WebM/MOV)</Label>
            <Input
              id="video-file"
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setVideoFile(f);
                if (f) setVideoUrl("");
              }}
              data-testid="input-video-file"
            />
            <p className="text-sm text-gray-500 mt-1">
              Max size: {Math.round(maxVideoBytes / 1024 / 1024)}MB. Or use a Video URL below.
            </p>

            <div className="mt-3">
              <Label htmlFor="video-url">Video URL (Optional)</Label>
              <Input
                id="video-url"
                type="url"
                placeholder="https://example.com/video.mp4"
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  if (e.target.value) setVideoFile(null);
                }}
                data-testid="input-video-url"
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="post-content">Post Content</Label>
          <Textarea
            id="post-content"
            placeholder="What's on your mind? Try different types of content to see how AI moderation works..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="mt-2"
            data-testid="textarea-post-content"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-500">
              {content.length}/{textCharLimit} characters
            </span>
            <Badge variant="outline" className="text-xs">
              {language.toUpperCase()}
            </Badge>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!content.trim() || isSubmitting || content.length > textCharLimit}
          className="w-full bg-primary hover:bg-primary/90"
          data-testid="button-create-post"
        >
          {isSubmitting ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Creating Post...
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane mr-2"></i>
              Create Post
            </>
          )}
        </Button>
      </form>

      {/* Example Posts */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Try These Examples</h4>
        <div className="grid grid-cols-1 gap-3">
          {examplePosts.map((example, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                example.type === "safe" ? "border-green-200 bg-green-50" :
                example.type === "warning" ? "border-orange-200 bg-orange-50" :
                example.type === "danger" ? "border-red-200 bg-red-50" :
                example.type === "multilingual" ? "border-blue-200 bg-blue-50" :
                "border-purple-200 bg-purple-50"
              }`}
              onClick={() => useExample(example.text)}
              data-testid={`example-post-${index}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${
                  example.type === "safe" ? "text-green-800" :
                  example.type === "warning" ? "text-orange-800" :
                  example.type === "danger" ? "text-red-800" :
                  example.type === "multilingual" ? "text-blue-800" :
                  "text-purple-800"
                }`}>
                  {example.label}
                </span>
                <i className={`fas ${
                  example.type === "safe" ? "fa-check-circle text-green-600" :
                  example.type === "warning" ? "fa-exclamation-triangle text-orange-600" :
                  example.type === "danger" ? "fa-times-circle text-red-600" :
                  example.type === "multilingual" ? "fa-globe text-blue-600" :
                  "fa-ban text-purple-600"
                } text-sm`}></i>
              </div>
              <p className={`text-sm ${
                example.type === "safe" ? "text-green-700" :
                example.type === "warning" ? "text-orange-700" :
                example.type === "danger" ? "text-red-700" :
                example.type === "multilingual" ? "text-blue-700" :
                "text-purple-700"
              }`}>
                {example.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Features Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          <i className="fas fa-info-circle mr-2"></i>
          How AI Moderation Works
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Posts are analyzed in real-time for harmful content</li>
          <li>• Multi-language support including Hindi and English</li>
          <li>• High-confidence violations are automatically blocked</li>
          <li>• Suspicious content is flagged for manual review</li>
          <li>• User reputation scores are updated based on violations</li>
          <li>• Image content is analyzed for inappropriate material</li>
        </ul>
      </div>
    </div>
  );
}
