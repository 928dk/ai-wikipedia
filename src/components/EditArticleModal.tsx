import { useState } from 'react';
import { Article, ArticleImage } from '../types';

export function EditArticleModal({ 
  article, 
  onClose, 
  onSave 
}: { 
  article: Article;
  onClose: () => void;
  onSave: (article: Article) => void;
}) {
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const [summary, setSummary] = useState(article.summary || '');
  const [images, setImages] = useState<ArticleImage[]>(article.images || []);
  const [saving, setSaving] = useState(false);
  const [showImageForm, setShowImageForm] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');

  const handleSave = () => {
    setSaving(true);
    const updated: Article = {
      ...article,
      title: title.trim(),
      content: content.trim(),
      summary: summary.trim() || content.slice(0, 200) + (content.length > 200 ? '...' : ''),
      images: images,
      updated_at: new Date().toISOString(),
    };
    onSave(updated);
    onClose();
  };

  const addImage = () => {
    if (!newImageUrl.trim()) return;
    const newImage: ArticleImage = {
      url: newImageUrl.trim(),
      alt: newImageAlt.trim() || title,
      caption: newImageCaption.trim() || undefined,
    };
    setImages([...images, newImage]);
    setNewImageUrl('');
    setNewImageAlt('');
    setNewImageCaption('');
    setShowImageForm(false);
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newImages = [...images];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setImages(newImages);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Article</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short description (optional)"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-y"
            />
          </div>
          
          {/* Images Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Images ({images.length})</h3>
              <button
                onClick={() => setShowImageForm(!showImageForm)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                {showImageForm ? 'Cancel' : '+ Add Image'}
              </button>
            </div>
            
            {showImageForm && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alt Text</label>
                  <input
                    type="text"
                    value={newImageAlt}
                    onChange={(e) => setNewImageAlt(e.target.value)}
                    placeholder="Description of image"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Caption (optional)</label>
                  <input
                    type="text"
                    value={newImageCaption}
                    onChange={(e) => setNewImageCaption(e.target.value)}
                    placeholder="Image caption"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <button
                  onClick={addImage}
                  disabled={!newImageUrl.trim()}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  Add Image
                </button>
              </div>
            )}
            
            {images.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm italic">No images. Click "+ Add Image" to add one.</p>
            ) : (
              <div className="space-y-3">
                {images.map((img, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="flex-shrink-0 w-16 h-16">
                      <img src={img.url} alt={img.alt} className="w-full h-full object-cover rounded" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{img.alt}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{img.url}</p>
                      {img.caption && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Caption: {img.caption}</p>}
                    </div>
                    <div className="flex-shrink-0 flex gap-1">
                      <button onClick={() => moveImage(index, 'up')} disabled={index === 0} className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30" title="Move up">↑</button>
                      <button onClick={() => moveImage(index, 'down')} disabled={index === images.length - 1} className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30" title="Move down">↓</button>
                      <button onClick={() => removeImage(index)} className="p-1 text-red-500 hover:text-red-700" title="Remove image">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-4 justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
