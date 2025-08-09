import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface CreatePostProps {
  onCreatePost: (content: string, contentType: string, imageUrl?: string) => Promise<void>;
}

export default function CreatePost({ onCreatePost }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("text");
  const [imageUrl, setImageUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreatePost(content, contentType, imageUrl || undefined);
      setContent("");
      setImageUrl("");
      setContentType("text");
    } catch (error) {
      console.error("Error creating post:", error);
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
            <Select value={contentType} onValueChange={setContentType}>
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
            <Label htmlFor="image-url">Image URL (Optional)</Label>
            <Input
              id="image-url"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              data-testid="input-image-url"
            />
            <p className="text-sm text-gray-500 mt-1">
              Add an image URL to test image moderation features
            </p>
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
              {content.length}/500 characters
            </span>
            <Badge variant="outline" className="text-xs">
              {language.toUpperCase()}
            </Badge>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!content.trim() || isSubmitting}
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
