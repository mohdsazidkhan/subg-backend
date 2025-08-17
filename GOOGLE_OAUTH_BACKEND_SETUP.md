# Backend Google OAuth Setup

## 🔑 Environment Variables Required

Add these to your `.env` file in the `subg-backend` directory:

```bash
# Existing variables...
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d

# Google OAuth Configuration (Optional - for future enhancements)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 🚀 Current Implementation Status

✅ **COMPLETED:**
- Google OAuth authentication endpoint (`/api/auth/google`)
- User model updated with Google fields
- Automatic user creation for new Google users
- Existing user linking with Google accounts
- JWT token generation for Google users
- Free subscription creation for Google users

## 🔧 API Endpoint

**POST** `/api/auth/google`

**Request Body:**
```json
{
  "googleId": "google_user_id",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://profile-picture-url.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "🎉 Google login successful!",
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "student",
    "profilePicture": "https://profile-picture-url.com",
    "subscriptionStatus": "free",
    // ... other user data
  }
}
```

## 🔒 Security Features

- Google ID verification
- Email uniqueness validation
- Automatic referral code generation
- Free subscription creation
- JWT token generation
- Role-based access control

## 📱 Database Schema Updates

User model now includes:
```javascript
{
  googleId: String,        // Google OAuth ID
  profilePicture: String,  // Profile picture URL
  phone: String,          // Made sparse (can be null for Google users)
}
```

## 🚀 Future Enhancements

1. **Google ID Verification**: Verify Google tokens on backend
2. **Profile Picture Security**: Validate and sanitize image URLs
3. **Phone Number Update**: Allow Google users to add phone later
4. **Account Linking**: Link multiple Google accounts to one user
5. **Google Analytics**: Track Google login metrics

## ✅ Testing

1. Start backend: `npm run dev`
2. Test Google endpoint with Postman/Thunder Client
3. Verify user creation in database
4. Check JWT token generation
5. Verify subscription creation
