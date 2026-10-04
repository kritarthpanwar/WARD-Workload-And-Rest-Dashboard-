"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Public web config for the WARD Firebase project. These values identify the
// project to Google; they are not secrets.
const firebaseConfig = {
  apiKey: "AIzaSyAAPCP2_RA5JB1oli1AOyWASMVhLClOhlg",
  authDomain: "ward-1e2ac.firebaseapp.com",
  projectId: "ward-1e2ac",
  storageBucket: "ward-1e2ac.firebasestorage.app",
  messagingSenderId: "572039557130",
  appId: "1:572039557130:web:4837408e4825012d9d2ff3",
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(app);
