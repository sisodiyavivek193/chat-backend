# ChatApp Backend 🚀

## Setup Instructions

### 1. Install Dependencies
```powershell
cd backend
npm install
```

### 2. Configure .env
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/chatapp?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:5173
```

### 3. Run Development Server
```powershell
npm run dev
```

### 4. Add User via PowerShell
```powershell
# 1. add-user.js file mein details change karo (line 6-11)
# 2. Phir run karo:
node add-user.js
```

---

## API Endpoints

### 🔐 Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/check-username/:username` | Real-time username check |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (email or username) |
| GET | `/api/auth/me` | Get current user |

**Register Body:**
```json
{
  "fullName": "Raj Kumar",
  "username": "raj_kumar",
  "email": "raj@example.com",
  "password": "yourpassword"
}
```

**Login Body:**
```json
{
  "identifier": "raj_kumar",
  "password": "yourpassword"
}
```

---

### 👥 Friends
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/friends/request` | Send friend request |
| PUT | `/api/friends/accept/:requestId` | Accept request |
| PUT | `/api/friends/reject/:requestId` | Reject request |
| DELETE | `/api/friends/cancel/:requestId` | Cancel sent request |
| GET | `/api/friends/pending` | Incoming pending requests |
| GET | `/api/friends/list` | All friends list |

**Send Friend Request Body:**
```json
{ "toUserId": "user_mongo_id" }
```

---

### 👤 Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?username=raj` | Search users |
| POST | `/api/users/block/:userId` | Block user |
| DELETE | `/api/users/unblock/:userId` | Unblock user |
| GET | `/api/users/blocked` | My blocked list |
| GET | `/api/users/:userId` | Get user profile |

---

### 💬 Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/conversations` | Chat list (left sidebar) |
| GET | `/api/chat/messages/:userId` | Get messages with user |
| POST | `/api/chat/send` | Send message |
| DELETE | `/api/chat/message/:messageId` | Delete message |

**Send Message Body:**
```json
{
  "toUserId": "user_mongo_id",
  "encryptedContent": "encrypted_message_text"
}
```

---

## 🔌 Socket.io Events

### Client → Server
| Event | Data | Description |
|-------|------|-------------|
| `typing` | `{ toUserId }` | Show typing indicator |
| `stopTyping` | `{ toUserId }` | Hide typing indicator |

### Server → Client
| Event | Data | Description |
|-------|------|-------------|
| `newMessage` | `{ message, conversationId }` | New message received |
| `messageDeleted` | `{ messageId, conversationId }` | Message deleted |
| `friendRequestReceived` | `{ requestId, fromUser }` | New friend request |
| `friendRequestAccepted` | `{ message, user }` | Request accepted |
| `friendRequestRejected` | `{ message, userId }` | Request rejected |
| `userOnline` | `{ userId }` | User came online |
| `userOffline` | `{ userId }` | User went offline |
| `userTyping` | `{ fromUserId, fromUsername }` | Someone is typing |
| `userStoppedTyping` | `{ fromUserId }` | Typing stopped |

### Socket Connection (Frontend)
```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: { token: localStorage.getItem("token") }
});
```

---

## 🔒 E2E Encryption (Client-side)

Messages ko send karte time encrypt karo, receive karte time decrypt karo:

```javascript
import CryptoJS from "crypto-js";

const SECRET_KEY = "shared_secret_key"; // dono users ke paas hona chahiye

// Encrypt before sending
const encrypt = (message) => {
  return CryptoJS.AES.encrypt(message, SECRET_KEY).toString();
};

// Decrypt after receiving  
const decrypt = (encryptedMessage) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
```

---

## 🚀 Railway Deployment
1. GitHub pe push karo
2. Railway.app pe new project → "Deploy from GitHub"
3. Environment variables add karo (.env ka sara content)
4. Auto-deploy ho jayega!
