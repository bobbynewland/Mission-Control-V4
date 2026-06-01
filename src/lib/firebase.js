import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, push, remove, onValue, update } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAVmSmiuJDcCAiZhq3xqXSJZnWtviLvnuU",
  authDomain: "winslow-756c3.firebaseapp.com",
  databaseURL: "https://winslow-756c3-default-rtdb.firebaseio.com",
  projectId: "winslow-756c3",
  storageBucket: "winslow-756c3.appspot.com",
  messagingSenderId: "114362401734976703623",
  appId: "1:114362401734976703623:web:abc123def456"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

export const db = {
  kanban: {
    ref: () => ref(database, 'workspaces/winslow_main/tasks'),
    set: (data) => set(ref(database, 'workspaces/winslow_main/tasks'), data),
    get: () => get(ref(database, 'workspaces/winslow_main/tasks')),
    subscribe: (callback) => onValue(ref(database, 'workspaces/winslow_main/tasks'), (snapshot) => callback(snapshot.val())),
    push: (data) => push(ref(database, 'workspaces/winslow_main/tasks'), data),
    updateTask: (id, data) => update(ref(database, `workspaces/winslow_main/tasks/${id}`), data),
    removeTask: (id) => remove(ref(database, `workspaces/winslow_main/tasks/${id}`))
  },
  content: {
    ref: () => ref(database, 'workspaces/winslow_main/content'),
    get: () => get(ref(database, 'workspaces/winslow_main/content')),
    subscribe: (callback) => onValue(ref(database, 'workspaces/winslow_main/content'), (snapshot) => callback(snapshot.val())),
    set: (data) => set(ref(database, 'workspaces/winslow_main/content'), data),
    update: (id, data) => update(ref(database, `workspaces/winslow_main/content/${id}`), data),
    remove: (id) => remove(ref(database, `workspaces/winslow_main/content/${id}`)),
    push: (data) => push(ref(database, 'workspaces/winslow_main/content'), data)
  },
  clients: {
    ref: () => ref(database, 'workspaces/winslow_main/clients'),
    get: () => get(ref(database, 'workspaces/winslow_main/clients')),
    subscribe: (callback) => onValue(ref(database, 'workspaces/winslow_main/clients'), (snapshot) => callback(snapshot.val())),
    set: (data) => set(ref(database, 'workspaces/winslow_main/clients'), data),
    update: (id, data) => update(ref(database, `workspaces/winslow_main/clients/${id}`), data),
    remove: (id) => remove(ref(database, `workspaces/winslow_main/clients/${id}`)),
    push: (data) => push(ref(database, 'workspaces/winslow_main/clients'), data)
  },
  log: {
    ref: () => ref(database, 'workspaces/winslow_main/log'),
    get: () => get(ref(database, 'workspaces/winslow_main/log')),
    subscribe: (callback) => onValue(ref(database, 'workspaces/winslow_main/log'), (snapshot) => callback(snapshot.val())),
    set: (data) => set(ref(database, 'workspaces/winslow_main/log'), data),
    update: (id, data) => update(ref(database, `workspaces/winslow_main/log/${id}`), data),
    remove: (id) => remove(ref(database, `workspaces/winslow_main/log/${id}`)),
    push: (data) => push(ref(database, 'workspaces/winslow_main/log'), data)
  },
  knowledge: {
    ref: () => ref(database, 'workspaces/winslow_main/knowledge'),
    get: () => get(ref(database, 'workspaces/winslow_main/knowledge')),
    subscribe: (callback) => onValue(ref(database, 'workspaces/winslow_main/knowledge'), (snapshot) => callback(snapshot.val())),
    set: (data) => set(ref(database, 'workspaces/winslow_main/knowledge'), data),
    update: (id, data) => update(ref(database, `workspaces/winslow_main/knowledge/${id}`), data),
    remove: (id) => remove(ref(database, `workspaces/winslow_main/knowledge/${id}`)),
    push: (data) => push(ref(database, 'workspaces/winslow_main/knowledge'), data)
  },
  agentActivity: {
    ref: () => ref(database, 'workspaces/winslow_main/agent_activity'),
    set: (data) => set(ref(database, 'workspaces/winslow_main/agent_activity'), data),
    get: () => get(ref(database, 'workspaces/winslow_main/agent_activity')),
    subscribe: (callback) => onValue(ref(database, 'workspaces/winslow_main/agent_activity'), (snapshot) => callback(snapshot.val())),
    push: (data) => push(ref(database, 'workspaces/winslow_main/agent_activity'), data),
    updateActivity: (id, data) => update(ref(database, `workspaces/winslow_main/agent_activity/${id}`), data),
    removeActivity: (id) => remove(ref(database, `workspaces/winslow_main/agent_activity/${id}`))
  },
  notes: {
    ref: () => ref(database, 'workspaces/winslow_main/notes'),
    set: (data) => set(ref(database, 'workspaces/winslow_main/notes'), data),
    get: (id) => get(ref(database, `workspaces/winslow_main/notes/${id}`)),
    list: () => get(ref(database, 'workspaces/winslow_main/notes')),
    subscribeList: (callback) => onValue(ref(database, 'workspaces/winslow_main/notes'), (snapshot) => callback(snapshot.val())),
    subscribeNote: (id, callback) => onValue(ref(database, `workspaces/winslow_main/notes/${id}`), (snapshot) => callback(snapshot.val())),
    push: (data) => push(ref(database, 'workspaces/winslow_main/notes'), data),
    updateNote: (id, data) => update(ref(database, `workspaces/winslow_main/notes/${id}`), data),
    removeNote: (id) => remove(ref(database, `workspaces/winslow_main/notes/${id}`))
  },
  obsidian: {
    ref: () => ref(database, 'workspaces/winslow_main/obsidian'),
    get: () => get(ref(database, 'workspaces/winslow_main/obsidian')),
    subscribeList: (callback) => onValue(ref(database, 'workspaces/winslow_main/obsidian'), (snapshot) => callback(snapshot.val())),
    list: () => get(ref(database, 'workspaces/winslow_main/obsidian')),
    set: (data) => set(ref(database, 'workspaces/winslow_main/obsidian'), data),
    update: (id, data) => update(ref(database, `workspaces/winslow_main/obsidian/${id}`), data),
    remove: (id) => remove(ref(database, `workspaces/winslow_main/obsidian/${id}`)),
    push: (data) => push(ref(database, 'workspaces/winslow_main/obsidian'), data)
  },
  projects: {
    ref: () => ref(database, 'workspaces/winslow_main/projects'),
    get: () => get(ref(database, 'workspaces/winslow_main/projects')),
    subscribe: (callback) => onValue(ref(database, 'workspaces/winslow_main/projects'), (snapshot) => callback(snapshot.val())),
    set: (data) => set(ref(database, 'workspaces/winslow_main/projects'), data),
    update: (id, data) => update(ref(database, `workspaces/winslow_main/projects/${id}`), data),
    remove: (id) => remove(ref(database, `workspaces/winslow_main/projects/${id}`)),
    push: (data) => push(ref(database, 'workspaces/winslow_main/projects'), data)
  },
  approvalQueue: {
    ref: () => ref(database, 'workspaces/winslow_main/approvalQueue'),
    get: () => get(ref(database, 'workspaces/winslow_main/approvalQueue')),
    subscribe: (callback) => onValue(ref(database, 'workspaces/winslow_main/approvalQueue'), (snapshot) => callback(snapshot.val())),
    set: (data) => set(ref(database, 'workspaces/winslow_main/approvalQueue'), data),
    update: (id, data) => update(ref(database, `workspaces/winslow_main/approvalQueue/${id}`), data),

    // Per-step persistence helpers (used by agents/backends; UI reads these fields)
    // Schema (suggested): approvalQueue/{id}/steps/{stepId} = { status, updatedAt, outputs, artifacts: [], logs: [] }
    updateStep: (id, stepId, data) => update(ref(database, `workspaces/winslow_main/approvalQueue/${id}/steps/${stepId}`), data),
    appendStepLog: async (id, stepId, entry) => {
      const logRef = push(ref(database, `workspaces/winslow_main/approvalQueue/${id}/steps/${stepId}/logs`));
      await set(logRef, entry);
      return logRef.key;
    },
    addStepArtifact: async (id, stepId, artifact) => {
      const artRef = push(ref(database, `workspaces/winslow_main/approvalQueue/${id}/steps/${stepId}/artifacts`));
      await set(artRef, artifact);
      return artRef.key;
    },

    remove: (id) => remove(ref(database, `workspaces/winslow_main/approvalQueue/${id}`)),
    push: (data) => push(ref(database, 'workspaces/winslow_main/approvalQueue'), data)
  }
};

export const storageService = {
  upload: async (file, path = 'uploads') => {
    const fileRef = storageRef(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  }
};

export { database, storage, ref, onValue, set, get, push, remove, update };
export default app;
