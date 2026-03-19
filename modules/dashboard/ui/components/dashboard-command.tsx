import { Dispatch, SetStateAction } from "react";

import { 
  CommandResponsiveDialog,
  CommandInput, 
  CommandItem, 
  CommandList, 
  Command }  from "@/components/ui/command";

interface Props {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
};

export const DashboardCommand = ({ open, setOpen }: Props) => {
  return (
    <CommandResponsiveDialog open={open} onOpenChange={setOpen}>
        <Command>
            <CommandInput
                placeholder="Find a meeting or agent"
            />
            <CommandList>
                <CommandItem>
                Test
                </CommandItem>
                <CommandItem>
                Test 2
                </CommandItem>
            </CommandList>
        </Command>
    </CommandResponsiveDialog>
  );
};