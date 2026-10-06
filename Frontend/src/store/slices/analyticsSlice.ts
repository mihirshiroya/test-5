import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { analyticsApi } from "../../api/analytics"
import {
  type AnalyticsData,
  type ProfileAnalytics,
  type SessionDay,
  localDayKey,
} from "../../components/Ui/analytics-data"

type Status = "idle" | "loading" | "succeeded" | "failed"

interface Resource<T> {
  data: T | null
  status: Status
  error: string | null
}

export interface AnalyticsState {
  overview: Resource<AnalyticsData>
  sessions: Resource<SessionDay> & { selectedDate: string }
  profile: Resource<ProfileAnalytics> & { month: string | null }
}

const emptyResource = <T>(): Resource<T> => ({
  data: null,
  status: "idle",
  error: null,
})

const initialState: AnalyticsState = {
  overview: emptyResource<AnalyticsData>(),
  sessions: { ...emptyResource<SessionDay>(), selectedDate: localDayKey() },
  profile: { ...emptyResource<ProfileAnalytics>(), month: null },
}

const errMsg = (e: unknown): string => {
  const err = e as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Failed to load analytics"
}

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchOverview = createAsyncThunk<AnalyticsData, void, { rejectValue: string }>(
  "analytics/fetchOverview",
  async (_, { rejectWithValue }) => {
    try {
      return await analyticsApi.getOverview()
    } catch (e) {
      return rejectWithValue(errMsg(e))
    }
  },
)

export const fetchSessions = createAsyncThunk<SessionDay, string, { rejectValue: string }>(
  "analytics/fetchSessions",
  async (date, { rejectWithValue }) => {
    try {
      return await analyticsApi.getSessions(date)
    } catch (e) {
      return rejectWithValue(errMsg(e))
    }
  },
)

export const fetchProfileAnalytics = createAsyncThunk<
  ProfileAnalytics,
  string | undefined,
  { rejectValue: string }
>("analytics/fetchProfile", async (month, { rejectWithValue }) => {
  try {
    return await analyticsApi.getProfile(month)
  } catch (e) {
    return rejectWithValue(errMsg(e))
  }
})

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const analyticsSlice = createSlice({
  name: "analytics",
  initialState,
  reducers: {
    setSessionDate: (state, action: PayloadAction<string>) => {
      state.sessions.selectedDate = action.payload
    },
    setProfileMonth: (state, action: PayloadAction<string>) => {
      state.profile.month = action.payload
    },
    resetAnalytics: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // overview
      .addCase(fetchOverview.pending, (state) => {
        state.overview.status = "loading"
        state.overview.error = null
      })
      .addCase(fetchOverview.fulfilled, (state, action) => {
        state.overview.status = "succeeded"
        state.overview.data = action.payload
      })
      .addCase(fetchOverview.rejected, (state, action) => {
        state.overview.status = "failed"
        state.overview.error = action.payload ?? "Failed to load analytics"
      })

      // sessions
      .addCase(fetchSessions.pending, (state, action) => {
        state.sessions.status = "loading"
        state.sessions.error = null
        state.sessions.selectedDate = action.meta.arg
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        // Ignore stale responses when the user switched dates mid-request.
        if (action.payload.date !== state.sessions.selectedDate) return
        state.sessions.status = "succeeded"
        state.sessions.data = action.payload
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        if (action.meta.arg !== state.sessions.selectedDate) return
        state.sessions.status = "failed"
        state.sessions.error = action.payload ?? "Failed to load sessions"
      })

      // profile
      .addCase(fetchProfileAnalytics.pending, (state, action) => {
        state.profile.status = "loading"
        state.profile.error = null
        if (action.meta.arg) state.profile.month = action.meta.arg
      })
      .addCase(fetchProfileAnalytics.fulfilled, (state, action) => {
        state.profile.status = "succeeded"
        state.profile.data = action.payload
        state.profile.month = action.payload.monthly.month
      })
      .addCase(fetchProfileAnalytics.rejected, (state, action) => {
        state.profile.status = "failed"
        state.profile.error = action.payload ?? "Failed to load profile analytics"
      })
  },
})

export const { setSessionDate, setProfileMonth, resetAnalytics } = analyticsSlice.actions
export default analyticsSlice.reducer

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

type WithAnalytics = { analytics: AnalyticsState }

export const selectOverview = (s: WithAnalytics) => s.analytics.overview
export const selectSessions = (s: WithAnalytics) => s.analytics.sessions
export const selectProfileAnalytics = (s: WithAnalytics) => s.analytics.profile
