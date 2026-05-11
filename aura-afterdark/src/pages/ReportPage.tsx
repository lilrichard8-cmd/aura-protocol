import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Upload, X, Check } from 'lucide-react';

const reportReasons = [
  { id: 'spam', label: 'Spam or unwanted content', desc: 'Repetitive or promotional content that violates guidelines' },
  { id: 'harassment', label: 'Harassment or bullying', desc: 'Content that targets or harasses other users' },
  { id: 'violence', label: 'Violence or dangerous content', desc: 'Content that promotes violence or harmful activities' },
  { id: 'hate', label: 'Hate speech or discrimination', desc: 'Content that promotes hatred based on identity or characteristics' },
  { id: 'copyright', label: 'Copyright infringement', desc: 'Content that violates intellectual property rights' },
  { id: 'privacy', label: 'Privacy violation', desc: 'Content that shares private information without consent' },
  { id: 'nudity', label: 'Inappropriate sexual content', desc: 'Sexual content that violates community guidelines' },
  { id: 'misinformation', label: 'False or misleading information', desc: 'Content that spreads false or harmful information' },
  { id: 'underage', label: 'Underage user concerns', desc: 'Concerns about user age or protection of minors' },
  { id: 'other', label: 'Other violation', desc: 'Other violations of community guidelines not listed above' },
];

export default function ReportPage() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setEvidence(prev => [...prev, ...files].slice(0, 5)); // Max 5 files
  };
  
  const removeFile = (index: number) => {
    setEvidence(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;
    
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
  };
  
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-aura-bg text-aura-text md:pl-64">
        <div className="max-w-3xl mx-auto p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Report Submitted</h1>
            <p className="text-aura-text-secondary mb-6">
              Thank you for helping keep our community safe. We'll review your report within 24-48 hours.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate(-1)}
                className="block w-full sm:w-auto mx-auto px-6 py-3 bg-aura-accent hover:bg-aura-accent-hover text-white rounded-lg transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => navigate('/')}
                className="block w-full sm:w-auto mx-auto px-6 py-3 bg-aura-surface hover:bg-aura-surface/80 border border-aura-border rounded-lg transition-colors"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-aura-bg text-aura-text md:pl-64">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-8 h-8 text-aura-accent" />
            <h1 className="text-3xl font-bold">Report Content</h1>
          </div>
          <p className="text-aura-text-secondary">
            Help us maintain a safe and welcoming community by reporting content that violates our guidelines.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Content Info */}
          <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
            <h2 className="text-xl font-semibold mb-4">Content Being Reported</h2>
            <div className="flex items-center gap-4 p-4 bg-aura-surface rounded-lg">
              <div className="w-16 h-16 bg-aura-accent/20 rounded-lg flex items-center justify-center">
                <span className="text-aura-accent font-mono text-sm">#{contentId}</span>
              </div>
              <div>
                <p className="font-medium">Content ID: {contentId}</p>
                <p className="text-sm text-aura-text-secondary">
                  We'll investigate this content based on your report
                </p>
              </div>
            </div>
          </div>
          
          {/* Reason Selection */}
          <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
            <h2 className="text-xl font-semibold mb-4">Why are you reporting this content? *</h2>
            <div className="space-y-3">
              {reportReasons.map(reason => (
                <label
                  key={reason.id}
                  className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedReason === reason.id
                      ? 'bg-aura-accent/20 border-2 border-aura-accent'
                      : 'bg-aura-surface hover:bg-aura-surface/80 border-2 border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-1 text-aura-accent"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">{reason.label}</h3>
                    <p className="text-sm text-aura-text-secondary">{reason.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          {/* Additional Details */}
          <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
            <h2 className="text-xl font-semibold mb-4">Additional Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Describe the issue (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Please provide any additional context or details that would help us understand the issue..."
                  className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent resize-none"
                />
                <p className="text-xs text-aura-text-secondary mt-1">
                  {description.length}/500 characters
                </p>
              </div>
              
              {/* Evidence Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Upload Evidence (optional)
                </label>
                <p className="text-xs text-aura-text-secondary mb-3">
                  Screenshots or other files that support your report. Max 5 files, 10MB each.
                </p>
                
                <div className="space-y-3">
                  {evidence.length > 0 && (
                    <div className="space-y-2">
                      {evidence.map((file, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-aura-surface rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-aura-text-secondary">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="w-8 h-8 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {evidence.length < 5 && (
                    <label className="flex items-center gap-3 p-4 border-2 border-dashed border-aura-border hover:border-aura-accent rounded-lg cursor-pointer transition-colors">
                      <Upload className="w-6 h-6 text-aura-text-secondary" />
                      <div className="text-sm">
                        <span className="font-medium text-aura-accent">Click to upload</span>
                        <span className="text-aura-text-secondary"> or drag and drop files</span>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Community Guidelines Reference */}
          <div className="bg-aura-surface p-6 rounded-lg border border-aura-border">
            <h3 className="font-semibold mb-3">Community Guidelines</h3>
            <p className="text-sm text-aura-text-secondary mb-4">
              Reports are reviewed against our community guidelines. False or malicious reports may result in account restrictions.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-aura-card rounded-full text-xs">Respectful Community</span>
              <span className="px-3 py-1 bg-aura-card rounded-full text-xs">No Harassment</span>
              <span className="px-3 py-1 bg-aura-card rounded-full text-xs">Authentic Content</span>
              <span className="px-3 py-1 bg-aura-card rounded-full text-xs">Legal Compliance</span>
            </div>
          </div>
          
          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-aura-surface hover:bg-aura-surface/80 border border-aura-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={!selectedReason || isSubmitting}
              className="px-6 py-3 bg-aura-accent hover:bg-aura-accent-hover disabled:bg-aura-surface disabled:text-aura-text-secondary text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}