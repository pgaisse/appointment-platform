import { DataEvents } from "@/Components/CustomTemplates/CustomCardPatient";
import { Data } from "@/Components/Scheduler/CustomCalendar";
import { Appointment } from "@/types";

export function createEvents(data: Appointment[] = []): Data[] {
    const event = data.flatMap((item, index) =>
        (item.selectedAppDates?item.selectedAppDates:[]).map((date, dateIndex) => ({
            title: `${item.nameInput} ${item.lastNameInput}`,
            start: new Date(date.startDate),
            end: new Date(date.endDate),
            desc: item.textAreaInput || "No description",
            name: item.nameInput,
            lastName: item.lastNameInput,
            _id: item._id,
            color: `${item.priority.color}` || "gray",
        
        }))
    );

    return event;
}

export function getStringDates(data: Data[]):string[] {
    return data.map(e => new Date(e.start).toDateString());
  }