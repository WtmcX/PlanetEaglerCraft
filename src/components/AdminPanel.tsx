import React, { useState, useEffect } from 'react';
import { Upload, Package, Code, Gamepad2, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ContentFormData {
  title: string;
  type: string;
  description: string;
  version: string;
  file_size: string;
  image: string;
  file_url?: string;
}

const MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export function AdminPanel() {
  const [formData, setFormData] = useState<ContentFormData>({
    title: '',
    type: 'Resource Pack',
    description: '',
    version: '',
    file_size: '',
    image: ''
  });
  const [content, setContent] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>("Checking...");

  useEffect(() => {
    fetchContent();
    checkAuthStatus();
  }, []);

  const fetchContent = async () => {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching content:', error);
      return;
    }

    setContent(data || []);
  };

  const checkAuthStatus = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setAuthStatus(`Authenticated as: ${data.session.user.email}`);
    } else {
      setAuthStatus("Not authenticated - delete may not work");
    }
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      
      // Generate a unique file name with original extension
      const fileExt = file.name.split('.').pop();
      const uniqueId = Math.random().toString(36).substring(2);
      const fileName = `${uniqueId}-${file.name}`;
      const filePath = `content/${fileName}`;

      // Use a Content-Type that forces download for HTML files
      let contentType = file.type;
      if (file.type === 'text/html' || fileExt?.toLowerCase() === 'html') {
        contentType = 'application/octet-stream';
      }

      // Upload with modified content type
      const { error: uploadError } = await supabase.storage
        .from('content-files')
        .upload(filePath, file, {
          contentType: contentType,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content-files')
        .getPublicUrl(filePath);

      return {
        url: publicUrl,
        size: (file.size / (1024 * 1024)).toFixed(2) + 'MB'
      };
    } catch (err) {
      console.error('Error uploading file:', err);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      let fileData = null;
      if (file) {
        fileData = await uploadFile(file);
      }

      const contentData = {
        ...formData,
        file_size: fileData?.size || formData.file_size,
        file_url: fileData?.url || formData.file_url
      };

      if (isEditing) {
        // Update existing content
        const { error } = await supabase
          .from('content')
          .update({
            ...contentData,
            updated_at: new Date().toISOString()
          })
          .eq('id', isEditing);

        if (error) throw error;
      } else {
        // Create new content
        const { error } = await supabase
          .from('content')
          .insert([{
            ...contentData,
            downloads: 0,
            rating: 0,
            author: 'admin'
          }]);

        if (error) throw error;
      }

      // Reset form and refresh content
      setFormData({
        title: '',
        type: 'Resource Pack',
        description: '',
        version: '',
        file_size: '',
        image: ''
      });
      setIsEditing(null);
      setFile(null);
      fetchContent();
    } catch (err) {
      console.error('Error saving content:', err);
      setError('Failed to save content. Please try again.');
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      title: item.title,
      type: item.type,
      description: item.description,
      version: item.version,
      file_size: item.file_size,
      image: item.image,
      file_url: item.file_url
    });
    setIsEditing(item.id);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      console.log('Attempting to delete content with ID:', id);
      
      // Server-side delete attempt
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Supabase delete error:', error);
        // Still remove it from local state even if the server error occurs
        setContent(prev => prev.filter(item => item.id !== id));
        console.log('Removed from local state due to server error');
      } else {
        // If successful, refresh from server
        await fetchContent();
      }
      
      // Clear the deleting state
      setDeletingId(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting content:', err);
      setError('Failed to delete content on server, but removed from view.');
      // Still remove it from local state even if there's an error
      setContent(prev => prev.filter(item => item.id !== id));
    }
  };
  
  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    
    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) { // 50MB
      setError("File size exceeds the 50MB limit. Please select a smaller file.");
      e.target.value = ''; // Reset the input
      return;
    }
    
    setFile(selectedFile);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 dark:text-white">Admin Panel</h1>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-lg mb-6">
          Auth status: {authStatus}
        </div>

        {/* Content Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {isEditing ? 'Edit Content' : 'Add New Content'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option>Resource Pack</option>
                  <option>Mod</option>
                  <option>Client</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Size
                </label>
                <input
                  type="text"
                  value={formData.file_size}
                  onChange={(e) => setFormData({ ...formData, file_size: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content File
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full"
                />
                {uploading && (
                  <p className="text-sm text-indigo-600 mt-1">Uploading file...</p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      title: '',
                      type: 'Resource Pack',
                      description: '',
                      version: '',
                      file_size: '',
                      image: ''
                    });
                    setIsEditing(null);
                    setFile(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={uploading}
                className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 flex items-center ${
                  uploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isEditing ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Update Content
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    Add Content
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this content? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingId(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deletingId && handleDelete(deletingId)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Manage Content</h2>
          <div className="space-y-4">
            {content.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-gray-500">
                    {item.type} • Version {item.version} • {item.downloads} downloads
                  </p>
                  {item.file_url && (
                    <p className="text-xs text-indigo-600 mt-1">File uploaded</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-md"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => confirmDelete(item.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}