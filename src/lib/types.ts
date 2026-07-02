export type Project = {
  id: string;
  user_id: string;
  name: string;
  active: boolean;
  created_at: string;
};

export type DayType = "working_day" | "vacation" | "sick_leave" | "holiday";

export type DayRecord = {
  id: string;
  user_id: string;
  date: string;
  day_type: DayType;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type TimeEntry = {
  id: string;
  user_id: string;
  date: string;
  project_id: string | null;
  hours: number;
  note: string | null;
  created_at: string;
  projects?: Pick<Project, "id" | "name" | "active"> | null;
};

export type OvertimeDay = {
  user_id: string;
  date: string;
  total_hours: number;
  overtime_hours: number;
};
