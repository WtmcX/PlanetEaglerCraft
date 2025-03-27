import React, { useState, useEffect } from 'react';
import { Search, Upload, Package, Code, Gamepad2, TrendingUp, Star, Download } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';

interface Comment {
  id: string;
  content_id: string;
  author: string;
  text: string;
  created_at: string;
}

interface ContentCard {
  id: string;
  title: string;
  author: string;
  type: string;
  downloads: number;
  image: string;
  rating: number;
  ratings_count?: number;
  description?: string;
  version?: string;
  file_size?: string;
  file_url?: string;
  created_at?: string;
  updated_at?: string;
}

function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedContent, setSelectedContent] = useState<ContentCard | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [featuredContent, setFeaturedContent] = useState<ContentCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filteredContent, setFilteredContent] = useState<ContentCard[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    checkAdmin();
    fetchContent();
  }, []);

  useEffect(() => {
    // Filter content whenever activeCategory or featuredContent changes
    if (activeCategory === 'all') {
      setFilteredContent(featuredContent);
    } else {
      const filtered = featuredContent.filter(content => {
        switch (activeCategory) {
          case 'resource-packs':
            return content.type === 'Resource Pack';
          case 'mods':
            return content.type === 'Mod';
          case 'clients':
            return content.type === 'Client';
          default:
            return true;
        }
      });
      setFilteredContent(filtered);
    }
  }, [activeCategory, featuredContent]);

  const checkAdmin = async () => {
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) {
        console.error('Auth error:', authError);
        setIsAdmin(false);
        return;
      }
      
      const isUserAdmin = !!session;
      console.log('Admin status check:', isUserAdmin ? 'User is admin' : 'User is not admin');
      setIsAdmin(isUserAdmin);
    } catch (err) {
      console.error('Error checking admin status:', err);
      setIsAdmin(false);
    }
  };

  const fetchContent = async () => {
    try {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .order('downloads', { ascending: false });

      if (error) {
        setError('Error fetching content. Please try again later.');
        console.error('Error fetching content:', error);
        return;
      }

      setFeaturedContent(data || []);
      setFilteredContent(data || []);
      setError(null);
    } catch (err) {
      setError('An unexpected error occurred. Please try again later.');
      console.error('Unexpected error:', err);
    }
  };

  const handleLogin = () => {
    setIsAdmin(true);
    setShowAdminPanel(true);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setIsAdmin(false);
      setShowAdminPanel(false);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleDownload = async (content: ContentCard) => {
    try {
      if (!content.file_url) {
        alert('No file available for download.');
        return;
      }

      // Update download count in database
      try {
        const { error } = await supabase
          .from('content')
          .update({ downloads: content.downloads + 1 })
          .eq('id', content.id);

        if (error) console.error('Error updating download count:', error);
      } catch (err) {
        console.error('Error in download count update:', err);
      }

      // Force download with more aggressive file type handling
      try {
        const response = await fetch(content.file_url);
        const blob = await response.blob();
        
        // Create a new blob with application/octet-stream type to force download
        const forceDownloadBlob = new Blob([blob], { type: 'application/octet-stream' });
        
        // Determine file extension based on original file type
        const fileExt = content.file_url.split('.').pop()?.toLowerCase() || 'html';
        const fileName = `${content.title.replace(/[^a-z0-9]/gi, '_')}.${fileExt}`;
        
        // Create download link
        const blobUrl = window.URL.createObjectURL(forceDownloadBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = fileName;
        downloadLink.target = '_blank';
        
        // Explicitly add to DOM, click, and remove
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Cleanup
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
        
        // Update UI state
        if (!error) {
          const updatedContent = { ...content, downloads: content.downloads + 1 };
          // Don't update selectedContent, which would trigger navigation
          // setSelectedContent(updatedContent); <- REMOVE THIS LINE
          
          // Just update the content in the lists
          setFeaturedContent(prev => prev.map(item => item.id === content.id ? updatedContent : item));
          setFilteredContent(prev => prev.map(item => item.id === content.id ? updatedContent : item));
        }
      } catch (downloadErr) {
        console.error('Download error:', downloadErr);
        
        // Fallback to window.open if the download method fails
        alert('Download started in a new tab. You may need to save the file manually.');
        window.open(content.file_url, '_blank');
      }
    } catch (err) {
      console.error('Error handling download:', err);
      alert('Failed to download. Please try again later.');
    }
  };

  const handleRate = async (contentId: string, rating: number) => {
    try {
      // Get the current content
      const content = selectedContent || filteredContent.find(item => item.id === contentId);
      if (!content) return;
      
      // Calculate new rating (assuming 'ratings_count' field exists or is 0)
      const currentRating = content.rating || 0;
      const ratingsCount = content.ratings_count || 0;
      const newRatingsCount = ratingsCount + 1;
      const newRating = ((currentRating * ratingsCount) + rating) / newRatingsCount;
      
      // Update in Supabase
      const { error } = await supabase
        .from('content')
        .update({ 
          rating: parseFloat(newRating.toFixed(1)), 
          ratings_count: newRatingsCount
        })
        .eq('id', contentId);
        
      if (error) {
        console.error('Error updating rating:', error);
        return;
      }
      
      // Update local state
      const updatedContent = { 
        ...content, 
        rating: parseFloat(newRating.toFixed(1)), 
        ratings_count: newRatingsCount 
      };
      
      if (selectedContent && selectedContent.id === contentId) {
        setSelectedContent(updatedContent);
      }
      
      setFeaturedContent(prev => 
        prev.map(item => item.id === contentId ? updatedContent : item)
      );
      setFilteredContent(prev => 
        prev.map(item => item.id === contentId ? updatedContent : item)
      );
      
      alert('Thank you for rating!');
    } catch (err) {
      console.error('Rating error:', err);
    }
  };

  const fetchComments = async (contentId: string) => {
    try {
      console.log('Fetching comments for content:', contentId);
      
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('content_id', contentId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }
      
      console.log('Comments fetched:', data);
      setComments(data || []);
    } catch (err) {
      console.error('Error in fetchComments:', err);
    }
  };

  const postComment = async (contentId: string) => {
    try {
      if (!commentAuthor.trim() || !commentText.trim()) {
        alert('Please enter your name and comment');
        return;
      }
      
      console.log('Submitting comment:', { 
        content_id: contentId,
        author: commentAuthor.trim(),
        text: commentText.trim()
      });
      
      // Add the new comment
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          content_id: contentId,
          author: commentAuthor.trim(),
          text: commentText.trim()
        }])
        .select(); // Get the newly created comment
        
      if (error) {
        console.error('Error posting comment:', error);
        alert(`Failed to post comment: ${error.message}`);
        return;
      }
      
      console.log('Comment posted successfully:', data);
      
      // Add the new comment to state and UI
      if (data && data.length > 0) {
        const newComment = data[0];
        setComments(prevComments => [newComment, ...prevComments]);
        
        // Clear form
        setCommentText('');
        // Optionally clear author too if you want
        // setCommentAuthor('');
        
        alert('Comment posted successfully!');
      } else {
        // If we didn't get the comment back, fetch all comments
        console.log('Fetching all comments after post');
        fetchComments(contentId);
      }
    } catch (err) {
      console.error('Error in postComment:', err);
      alert('An error occurred while posting your comment.');
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      // First check if user is admin
      if (!isAdmin) {
        console.error('Unauthorized deletion attempt');
        alert('Only administrators can delete comments.');
        return;
      }
      
      // Proceed with deletion if admin
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
        
      if (error) {
        console.error('Error deleting comment:', error);
        alert(`Failed to delete comment: ${error.message}`);
        return;
      }
      
      // Update local state
      setComments(prevComments => prevComments.filter(comment => comment.id !== commentId));
      alert('Comment deleted successfully');
    } catch (err) {
      console.error('Error in deleteComment:', err);
      alert('An error occurred while deleting the comment.');
    }
  };

  const handleSelectContent = (content: ContentCard) => {
    setSelectedContent(content);
    fetchComments(content.id);
  };

  if (!isAdmin && showAdminPanel) {
    return <Login onLogin={handleLogin} />;
  }

  if (showAdminPanel) {
    return (
      <div>
        <div className="bg-indigo-600 text-white px-4 py-2 flex justify-between items-center">
          <h1 className="text-xl font-bold cursor-pointer" onClick={() => setShowAdminPanel(false)}>
            CraftHub Admin
          </h1>
          <button
            onClick={handleLogout}
            className="text-white hover:text-indigo-200 transition-colors"
          >
            Logout
          </button>
        </div>
        <AdminPanel />
      </div>
    );
  }

  if (selectedContent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-indigo-600 text-white">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold cursor-pointer" onClick={() => setSelectedContent(null)}>CraftHub</h1>
              {isAdmin && (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="text-white hover:text-indigo-200 transition-colors"
                >
                  Admin Panel
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-4xl mx-auto">
            <img src={selectedContent.image} alt={selectedContent.title} className="w-full h-64 object-cover" />
            <div className="p-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">{selectedContent.title}</h1>
                <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                  {selectedContent.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <p className="text-gray-600 mb-4">{selectedContent.description}</p>
                  <p className="text-gray-700">by <span className="font-semibold">{selectedContent.author}</span></p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Version:</span>
                    <span className="font-medium">{selectedContent.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">File Size:</span>
                    <span className="font-medium">{selectedContent.file_size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="font-medium">
                      {new Date(selectedContent.updated_at || '').toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Downloads:</span>
                    <span className="font-medium">{selectedContent.downloads.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rating:</span>
                    <div className="flex items-center">
                      <Star className="h-5 w-5 text-yellow-400 mr-1" />
                      <span className="font-medium">{selectedContent.rating}/5.0</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => handleDownload(selectedContent)}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-500 transition-colors flex items-center text-lg font-semibold"
                  disabled={!selectedContent.file_url}
                >
                  <Download className="h-6 w-6 mr-2" />
                  Download Now
                </button>
              </div>

              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Rate this content:</h3>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => handleRate(selectedContent.id, star)}
                      className="p-2 hover:bg-yellow-50 rounded-full transition-colors"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= Math.round(selectedContent.rating || 0)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-gray-600 self-center">
                    {selectedContent.rating ? `${selectedContent.rating.toFixed(1)} / 5.0` : 'Not rated yet'} 
                    {selectedContent.ratings_count ? ` (${selectedContent.ratings_count} ratings)` : ''}
                  </span>
                </div>
              </div>

              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Comments</h3>
                
                {/* Comment Form */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Comment
                    </label>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      rows={3}
                      placeholder="What do you think about this content?"
                      required
                    />
                  </div>
                  <button
                    onClick={() => postComment(selectedContent.id)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors"
                  >
                    Post Comment
                  </button>
                </div>
                
                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-gray-500 italic">No comments yet. Be the first to comment!</p>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="border-b pb-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold">{comment.author}</h4>
                          <div className="flex items-center">
                            <span className="text-sm text-gray-500 mr-2">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                            {isAdmin && (
                              <button 
                                onClick={() => deleteComment(comment.id)}
                                className="text-red-500 hover:text-red-700 text-sm"
                                title="Delete comment"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-600">{comment.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">CraftHub</h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search content..."
                  className="pl-10 pr-4 py-2 rounded-lg bg-indigo-700 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-indigo-300" />
              </div>
              {isAdmin ? (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="flex items-center bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded-lg transition-colors"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Admin Panel
                </button>
              ) : (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="flex items-center bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded-lg transition-colors"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="flex space-x-4 mb-8">
          {[
            { id: 'all', name: 'All', icon: TrendingUp },
            { id: 'resource-packs', name: 'Resource Packs', icon: Package },
            { id: 'mods', name: 'Mods', icon: Code },
            { id: 'clients', name: 'Clients', icon: Gamepad2 }
          ].map(category => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  activeCategory === category.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5 mr-2" />
                {category.name}
              </button>
            );
          })}
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Featured Content</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map(content => (
              <div key={content.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <img src={content.image} alt={content.title} className="w-full h-48 object-cover" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-indigo-600">{content.type}</span>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 mr-1" />
                      <span className="text-sm text-gray-600">{content.rating}</span>
                    </div>
                  </div>
                  <h3 
                    className="text-xl font-semibold mb-2 cursor-pointer" 
                    onClick={() => handleSelectContent(content)}
                  >
                    {content.title}
                  </h3>
                  <p className="text-gray-600 mb-4">by {content.author}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-gray-500">
                      <Download className="h-4 w-4 mr-1" />
                      <span className="text-sm">{content.downloads.toLocaleString()}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleSelectContent(content)}
                        className="text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-600 text-sm transition-colors hover:bg-indigo-50"
                      >
                        Details
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault(); // Prevent any navigation
                          e.stopPropagation(); // Stop event bubbling
                          handleDownload(content);
                          return false; // Extra safety to prevent navigation
                        }}
                        className={`bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          !content.file_url ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500'
                        }`}
                        disabled={!content.file_url}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">CraftHub</h3>
              <p className="text-gray-400">Your one-stop platform for Minecraft content</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Community</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Reddit</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;