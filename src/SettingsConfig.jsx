
  const handleLogoUpload = (e, setDraft) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setDraft(prev => ({ ...prev, logo: reader.result }));
          };
          reader.readAsDataURL(file);
      }
  };

  const SettingsModal = ({ isOpen, onClose, draft, setDraft, onSave }) => {
    if (!isOpen || !draft) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
           <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
             <h3 className="text-lg font-bold text-gray-900 flex items-center">
               <Settings className="w-5 h-5 mr-2 text-fire-accent" />
               Report Settings
             </h3>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
               <X className="w-5 h-5" />
             </button>
           </div>
           
           <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
             {/* Logo Upload */}
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                <div className="flex items-center space-x-4">
                   <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                      {draft.logo ? (
                          <img src={draft.logo} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                          <Upload className="w-6 h-6 text-gray-300" />
                      )}
                      
                   </div>
                   <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="logo-upload" 
                        className="hidden" 
                        onChange={(e) => handleLogoUpload(e, setDraft)}
                      />
                      <label 
                        htmlFor="logo-upload"
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                      >
                         <Upload className="w-4 h-4 mr-2" />
                         Upload New Logo
                      </label>
                      <p className="mt-1 text-xs text-gray-500">Recommended: 200x200px PNG or JPG</p>
                   </div>
                </div>
             </div>
             
             {/* Report Title */}
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Report Title</label>
               <input 
                 type="text" 
                 value={draft.title || ''}
                 onChange={(e) => setDraft({...draft, title: e.target.value})}
                 className="w-full border-gray-300 rounded-md shadow-sm focus:ring-fire-accent focus:border-fire-accent text-sm" 
               />
             </div>

             {/* Brand Colors */}
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Colors</label>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <span className="text-xs text-gray-500 block mb-1">Primary Accent</span>
                      <div className="flex items-center space-x-2">
                         <input 
                            type="color" 
                            value={draft.colors.accent}
                            onChange={(e) => setDraft({...draft, colors: {...draft.colors, accent: e.target.value}})}
                            className="w-8 h-8 rounded border-0 p-0 cursor-pointer"
                         />
                         <input 
                            type="text" 
                            value={draft.colors.accent}
                            onChange={(e) => setDraft({...draft, colors: {...draft.colors, accent: e.target.value}})}
                            className="flex-1 border-gray-300 rounded-md text-xs uppercase"
                         />
                      </div>
                   </div>
                   <div>
                      <span className="text-xs text-gray-500 block mb-1">Heading Color</span>
                      <div className="flex items-center space-x-2">
                         <input 
                            type="color" 
                            value={draft.colors.heading}
                            onChange={(e) => setDraft({...draft, colors: {...draft.colors, heading: e.target.value}})}
                            className="w-8 h-8 rounded border-0 p-0 cursor-pointer"
                         />
                         <input 
                            type="text" 
                            value={draft.colors.heading}
                            onChange={(e) => setDraft({...draft, colors: {...draft.colors, heading: e.target.value}})}
                            className="flex-1 border-gray-300 rounded-md text-xs uppercase"
                         />
                      </div>
                   </div>
                </div>
             </div>
             
             {/* Typography */}
             <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                   <Type className="w-4 h-4 mr-1 text-gray-500"/>
                   Typography
                 </label>
                 <select
                   value={draft.font || 'Calibri'}
                   onChange={(e) => setDraft({...draft, font: e.target.value})}
                   className="w-full border-gray-300 rounded-md shadow-sm text-sm"
                 >
                    <option value="Calibri">Calibri (Standard)</option>
                    <option value="Inter">Inter (Modern Sans)</option>
                    <option value="Roboto">Roboto (Clean)</option>
                    <option value="Lato">Lato (Friendly)</option>
                    <option value="Open Sans">Open Sans (Neutral)</option>
                 </select>
                 <p className="mt-1 text-xs text-gray-500">
                    Selected font will be applied to the entire report interface.
                 </p>
             </div>

           </div>
           
           <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
             <button 
               onClick={onClose}
               className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
             >
               Cancel
             </button>
             <button 
               onClick={() => onSave(draft)}
               className="px-4 py-2 text-sm font-medium text-white bg-fire-accent hover:bg-opacity-90 rounded-md shadow-sm transition-colors"
             >
               Save Changes
             </button>
           </div>
        </div>
      </div>
    );
  };
