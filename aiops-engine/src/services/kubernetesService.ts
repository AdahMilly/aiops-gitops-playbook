import * as k8s from "@kubernetes/client-node";
import { SERVICES } from "../config/services";

const kc = new k8s.KubeConfig();

kc.loadFromDefault();

const api = kc.makeApiClient(k8s.CoreV1Api);

export async function getEvents() {
  const response = await api.listNamespacedEvent({
    namespace: SERVICES.APP.namespace,
  });

  return response.items;
}
