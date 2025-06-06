import { v1 } from "@docker/extension-api-client-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMCPClientStates } from "../MCPClients";

export function useMCPClient(client: v1.DockerDesktopClient) {
  // State
  const [buttonsLoading, setButtonsLoading] = useState<{
    [name: string]: boolean;
  }>({});
  const queryClient = useQueryClient();

  // Fetch MCP client states with React Query
  const {
    data: mcpClientStates,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["mcpClientStates"],
    networkMode: "always",
    queryFn: async () => getMCPClientStates(client),
  });

  // Update MCP client states
  const updateMCPClientStates = async () => {
    await refetch();
  };

  // Disconnect client mutation
  const disconnectMutation = useMutation({
    mutationFn: async (clientName: string) => {
      const clientState = mcpClientStates?.[clientName];
      if (!clientState) throw new Error(`Client ${clientName} not found`);

      // Perform the actual disconnect
      await clientState.client.disconnect(client);
    },
    onMutate: async (clientName) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["mcpClientStates"] });

      // Snapshot the previous value
      const previousStates = queryClient.getQueryData(["mcpClientStates"]);

      // Optimistically update to the new value
      if (mcpClientStates) {
        const updatedStates = {
          ...mcpClientStates,
          [clientName]: {
            ...mcpClientStates[clientName],
            configured: false,
          },
        };

        queryClient.setQueryData(["mcpClientStates"], updatedStates);
      }

      return { previousStates };
    },
    onSettled: () => {
      // Refetch after disconnect to ensure we have the latest state
      queryClient.invalidateQueries({ queryKey: ["mcpClientStates"] });
    },
  });

  // Connect client mutation
  const connectMutation = useMutation({
    mutationFn: async (clientName: string) => {
      const clientState = mcpClientStates?.[clientName];
      if (!clientState) throw new Error(`Client ${clientName} not found`);

      // Perform the actual connect
      await clientState.client.connect(client);
    },
    onMutate: async (clientName) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["mcpClientStates"] });

      // Snapshot the previous value
      const previousStates = queryClient.getQueryData(["mcpClientStates"]);

      // Optimistically update to the new value
      if (mcpClientStates) {
        const updatedStates = {
          ...mcpClientStates,
          [clientName]: {
            ...mcpClientStates[clientName],
            configured: true,
            exists: true,
          },
        };

        queryClient.setQueryData(["mcpClientStates"], updatedStates);
      }

      return { previousStates };
    },
    onSettled: () => {
      // Refetch after connect to ensure we have the latest state
      queryClient.invalidateQueries({ queryKey: ["mcpClientStates"] });
    },
  });

  // Expose mutation methods
  const disconnectClient = async (clientName: string) => {
    await disconnectMutation.mutateAsync(clientName);
  };

  const connectClient = async (clientName: string) => {
    await connectMutation.mutateAsync(clientName);
  };

  return {
    mcpClientStates,
    buttonsLoading,
    isLoading,
    isError,
    isFetching,
    updateMCPClientStates,
    setButtonsLoading,
    disconnectClient,
    connectClient,
  };
}
