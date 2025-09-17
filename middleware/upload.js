const multer = require('multer');

// Use memory storage so we can stream/upload buffers to Cloudinary directly
const storage = multer.memoryStorage();

// Basic image filter
function fileFilter(req, file, cb) {
  console.log('File filter called with fieldname:', file.fieldname);
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
}

const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// Create specific upload handlers for different field names
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    console.log('Upload middleware called for field:', fieldName);
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Create a multer instance that accepts any field but only processes the one we want
    const flexibleUpload = multer({ 
      storage, 
      fileFilter: (req, file, cb) => {
        console.log('File filter called with fieldname:', file.fieldname, 'expected:', fieldName);
        
        // Only process files with the expected field name
        if (file.fieldname === fieldName) {
          if (file.mimetype && file.mimetype.startsWith('image/')) {
            console.log('Accepting file:', file.fieldname);
            cb(null, true);
          } else {
            cb(new Error('Only image files are allowed'), false);
          }
        } else {
          // Skip files with other field names
          console.log('Skipping file with fieldname:', file.fieldname);
          cb(null, false);
        }
      }, 
      limits: { fileSize: 5 * 1024 * 1024 } 
    });
    
    // Use .any() to accept any number of fields, but our filter will only process the one we want
    flexibleUpload.any()(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        console.error('Error details:', {
          code: err.code,
          field: err.field,
          message: err.message
        });
        
        return res.status(400).json({
          success: false,
          message: 'File upload error: ' + err.message,
          details: err.message
        });
      }
      
      // Check if we got the file we expected
      const expectedFile = req.files ? req.files.find(file => file.fieldname === fieldName) : null;
      if (expectedFile) {
        // Move the file to req.file for compatibility with existing code
        req.file = expectedFile;
        console.log('File processed successfully:', expectedFile.fieldname);
      } else {
        console.log('No file found with fieldname:', fieldName);
      }
      
      next();
    });
  };
};

module.exports = {
  upload,
  uploadSingle
};


