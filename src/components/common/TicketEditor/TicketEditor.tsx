import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from 'store';
import {
  EuiGlobalToastList,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiIcon,
  EuiBadge
} from '@elastic/eui';
import { phaseTicketStore } from '../../../store/phase';
import { ActionButton, TicketButtonGroup } from '../../../people/widgetViews/workspace/style';
import {
  TicketContainer,
  TicketHeader,
  TicketTextArea,
  TicketInput,
  TicketHeaderInputWrap
} from '../../../pages/tickets/style';
import { TicketStatus, Ticket, Author } from '../../../store/interface';
import { Toast } from '../../../people/widgetViews/workspace/interface';
import { uiStore } from '../../../store/ui';
import { Select, Option } from '../../../people/widgetViews/workspace/style.ts';

interface TicketEditorProps {
  ticketData: Ticket;
  index: number;
  websocketSessionId: string;
  draggableId: string;
  hasInteractiveChildren: boolean;
  dragHandleProps?: Record<string, any>;
  swwfLink?: string;
  getPhaseTickets: () => Promise<Ticket[] | undefined>;
}

const TicketEditor = observer(
  ({
    ticketData,
    websocketSessionId,
    dragHandleProps,
    swwfLink,
    getPhaseTickets
  }: TicketEditorProps) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [versions, setVersions] = useState<number[]>([]);
    const latestTicket = phaseTicketStore.getLatestVersionFromGroup(
      ticketData.ticket_group as string
    );
    const [selectedVersion, setSelectedVersion] = useState<number>(latestTicket?.version as number);
    const [versionTicketData, setVersionTicketData] = useState<Ticket>(latestTicket as Ticket);
    const { main } = useStores();

    const groupTickets = useMemo(
      () => phaseTicketStore.getTicketsByGroup(ticketData.ticket_group as string),
      [ticketData.ticket_group]
    );

    useEffect(() => {
      const maxLimit = 21;
      const latestVersion = latestTicket?.version as number;
      const versionsArray = Array.from(
        { length: Math.min(latestVersion, maxLimit) },
        (_: number, index: number) => latestVersion - index
      );
      setVersions(versionsArray);
    }, [groupTickets, latestTicket?.version]);

    const addUpdateSuccessToast = () => {
      setToasts([
        {
          id: `${Date.now()}-success`,
          title: 'Hive',
          color: 'success',
          text: 'Updates Saved!'
        }
      ]);
    };

    const addUpdateErrorToast = () => {
      setToasts([
        {
          id: `${Date.now()}-error`,
          title: 'Hive',
          color: 'danger',
          text: 'We had an issue, try again!'
        }
      ]);
    };

    const handleUpdate = async () => {
      try {
        const ticketPayload = {
          metadata: {
            source: 'websocket',
            id: websocketSessionId
          },
          ticket: {
            ...ticketData,
            name: versionTicketData.name,
            description: versionTicketData.description,
            status: 'DRAFT' as TicketStatus,
            version: ticketData.version + 1,
            author: 'HUMAN' as Author,
            author_id: uiStore.meInfo?.pubkey,
            ticket_group: ticketData.ticket_group || ticketData.uuid
          }
        };

        const response = await main.createUpdateTicket(ticketPayload);

        if (response === 406 || !response) {
          throw new Error('Failed to update ticket');
        }

        setSelectedVersion(ticketData.version + 1);

        const phaseTickets = await getPhaseTickets();

        if (!Array.isArray(phaseTickets)) {
          console.error('Error: phaseTickets is not an array');
          return;
        }

        // Update phase ticket store with the latest tickets
        phaseTicketStore.clearPhaseTickets(ticketData.phase_uuid);
        for (const updatedTicket of phaseTickets) {
          if (updatedTicket.UUID) {
            updatedTicket.uuid = updatedTicket.UUID;
          }
          phaseTicketStore.addTicket(updatedTicket);
        }

        addUpdateSuccessToast();
      } catch (error) {
        console.error('Error updating ticket:', error);
        addUpdateErrorToast();
      }
    };

    const addSuccessToast = () => {
      setToasts([
        {
          id: `${Date.now()}-ticket-success`,
          title: 'Ticket Builder',
          color: 'success',
          text: "Success, I'll rewrite your ticket now!"
        }
      ]);
    };

    const addErrorToast = () => {
      setToasts([
        {
          id: `${Date.now()}-ticket-error`,
          title: 'Ticket Builder',
          color: 'danger',
          text: 'Sorry, there appears to be a problem'
        }
      ]);
    };

    const handleTicketBuilder = async () => {
      try {
        const ticketPayload = {
          metadata: {
            source: 'websocket',
            id: websocketSessionId
          },
          ticket: {
            ...ticketData,
            name: versionTicketData.name,
            description: versionTicketData.description,
            status: 'DRAFT' as TicketStatus,
            author: 'AGENT' as Author,
            author_id: 'TICKET_BUILDER',
            ticket_group: ticketData.ticket_group || ticketData.uuid
          }
        };

        const response = await main.sendTicketForReview(ticketPayload);

        if (response) {
          addSuccessToast();
        } else {
          throw new Error('Failed to send ticket for review');
        }
      } catch (error) {
        console.error('Error in ticket builder:', error);
        addErrorToast();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const version = Number(e.target.value);
      if (version !== selectedVersion) {
        setSelectedVersion(version);

        const selectedVerionTicket = groupTickets.find(
          (ticket: Ticket) => ticket.version === version
        );

        if (selectedVerionTicket) {
          setVersionTicketData({
            ...selectedVerionTicket
          });
        }
      }
    };

    return (
      <TicketContainer>
        <EuiFlexGroup alignItems="center" gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiPanel
              style={{ backgroundColor: 'white', border: 'none' }}
              color="transparent"
              className="drag-handle"
              paddingSize="s"
              {...dragHandleProps}
              aria-label="Drag Handle"
              key={ticketData.uuid}
              data-testid={`drag-handle-${ticketData.uuid}`}
            >
              <EuiIcon type="grab" />
            </EuiPanel>
          </EuiFlexItem>
          <EuiFlexItem>
            <TicketHeaderInputWrap>
              <TicketHeader>Ticket:</TicketHeader>
              <TicketInput
                value={versionTicketData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setVersionTicketData({ ...versionTicketData, name: e.target.value })
                }
                placeholder="Enter ticket name..."
              />
              <EuiBadge color="success" style={{ marginBottom: '12px' }}>
                Version {selectedVersion}
              </EuiBadge>
            </TicketHeaderInputWrap>
            <TicketTextArea
              value={versionTicketData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setVersionTicketData({ ...versionTicketData, description: e.target.value })
              }
              placeholder="Enter ticket details..."
            />
            <TicketButtonGroup>
              <Select
                value={selectedVersion}
                onChange={handleChange}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  marginRight: '10px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                {Array.from(new Set(versions)).map((version: number) => (
                  <Option key={version} value={version}>
                    Version {version}
                  </Option>
                ))}
              </Select>
              <ActionButton
                color="primary"
                onClick={handleUpdate}
                data-testid="story-input-update-btn"
              >
                Update
              </ActionButton>
              {swwfLink && (
                <ActionButton
                  as="a"
                  href={`https://jobs.stakwork.com/admin/projects/${swwfLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                  color="#49C998"
                >
                  SW Run: {swwfLink}
                </ActionButton>
              )}
              <ActionButton
                color="#49C998"
                onClick={handleTicketBuilder}
                data-testid="story-generate-btn"
              >
                Ticket Builder
              </ActionButton>
            </TicketButtonGroup>
            <EuiGlobalToastList
              toasts={toasts}
              dismissToast={() => setToasts([])}
              toastLifeTimeMs={3000}
            />
          </EuiFlexItem>
        </EuiFlexGroup>
      </TicketContainer>
    );
  }
);

export default TicketEditor;
