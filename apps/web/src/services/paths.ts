import { collection, doc } from "firebase/firestore";
import { db } from "../firebase";

export const userDoc = (uid: string) => doc(db, "users", uid);
export const papersCollection = (uid: string) => collection(db, "users", uid, "papers");
export const foldersCollection = (uid: string) => collection(db, "users", uid, "folders");
export const researchNotesCollection = (uid: string) => collection(db, "users", uid, "researchNotes");
