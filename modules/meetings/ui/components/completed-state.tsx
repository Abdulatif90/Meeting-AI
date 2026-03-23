import { MeetingGetOne } from "../../types";
import { MeetingDetailsTabs } from "./meeting-details-tabs";

interface Props {
  data: MeetingGetOne;
}

export const CompletedState = ({ data }: Props) => {
  return <MeetingDetailsTabs data={data} />;
};