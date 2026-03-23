import { MeetingGetOne } from "../../types";
import { MeetingDetailsTabs } from "./meeting-details-tabs";

interface Props {
  data: MeetingGetOne;
}

export const ProcessingState = ({ data }: Props) => {
  return <MeetingDetailsTabs data={data} />;
};