import {
  configureStore,
  combineReducers,
} from "@reduxjs/toolkit";

import {
  persistStore,
  persistReducer,
} from "redux-persist";

import storage from "redux-persist/lib/storage";

import {
  useDispatch,
  useSelector,
} from "react-redux";

import authReducer from "./slices/authSlice";
import adminReducer from "./slices/adminSlice";
import taskReducer from "./slices/taskSlice";
import notesReducer from "./slices/notesSlice";

// ---------------------------------------------------------------------------
// Persist configuration
// ---------------------------------------------------------------------------

const persistConfig = {
  key: "root",
  storage,
  whitelist: [
    "auth",
    "admin",
    "tasks",
    "notes",
  ],
};

// ---------------------------------------------------------------------------
// Root reducer
// ---------------------------------------------------------------------------

const rootReducer = combineReducers({
  auth: authReducer,
  admin: adminReducer,
  tasks: taskReducer,
  notes: notesReducer,
});

// ---------------------------------------------------------------------------
// Persisted reducer
// ---------------------------------------------------------------------------

const persistedReducer = persistReducer(
  persistConfig,
  rootReducer
);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const store = configureStore({
  reducer: persistedReducer,

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "persist/PERSIST",
          "persist/REHYDRATE",
        ],
      },
    }),
});

// ---------------------------------------------------------------------------
// Persistor
// ---------------------------------------------------------------------------

export const persistor = persistStore(store);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RootState =
  ReturnType<typeof store.getState>;

export type AppDispatch =
  typeof store.dispatch;

// ---------------------------------------------------------------------------
// Typed Redux Hooks
// ---------------------------------------------------------------------------

export const useAppDispatch =
  useDispatch.withTypes<AppDispatch>();

export const useAppSelector =
  useSelector.withTypes<RootState>();