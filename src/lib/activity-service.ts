import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type ActivityAction =
  | "finding.created"
  | "finding.updated"
  | "finding.deleted"
  | "finding.status_changed"
  | "finding.severity_changed"
  | "evidence.uploaded"
  | "evidence.deleted"
  | "report.generated"
  | "report.deleted"
  | "project.updated";

export interface ActivityLog {
  id?:          string;
  projectId:    string;
  action:       ActivityAction;
  userId:       string;
  userEmail:    string;
  userDisplay:  string;
  timestamp:    Timestamp | any; // serverTimestamp() returns FieldValue
  targetId?:    string;
  targetTitle?: string;
  field?:       string;
  oldValue?:    string;
  newValue?:    string;
}

export async function logActivity(
  projectId: string,
  user: { uid: string; email: string | null; displayName: string | null } | null | undefined,
  action: ActivityAction,
  context?: {
    targetId?:    string;
    targetTitle?: string;
    field?:       string;
    oldValue?:    string;
    newValue?:    string;
  }
): Promise<void> {
  // Silent fail: Audit logs must never break the main user flow.
  try {
    if (!user || user.uid === "guest") {
      return; // Skip logging for guest mode or anonymous users
    }

    const { uid, email, displayName } = user;
    const userDisplay = displayName ?? email?.split("@")[0] ?? "Unknown";

    const activityData: Omit<ActivityLog, "id"> = {
      projectId,
      action,
      userId: uid,
      userEmail: email || "",
      userDisplay,
      timestamp: serverTimestamp(),
      ...context,
    };

    const activityRef = collection(db, "projects", projectId, "activity");
    await addDoc(activityRef, activityData);
  } catch (error) {
    console.warn("Failed to log activity:", error);
  }
}
