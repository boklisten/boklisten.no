import type { MantineColor } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { NotificationData } from "@mantine/notifications";

import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

function showNotification(data: string | NotificationData, color: MantineColor) {
  if (typeof data === "string") {
    notifications.show({
      message: data,
      color,
      autoClose: true,
    });
  } else {
    notifications.show({
      color,
      autoClose: true,
      ...data,
    });
  }
}

export function showErrorNotification(data: string | NotificationData) {
  if (typeof data === "string") {
    notifications.show({
      title: data,
      message: PLEASE_TRY_AGAIN_TEXT,
      color: "red",
      autoClose: 6000,
    });
  } else {
    notifications.show({
      color: "red",
      autoClose: 6000,
      ...data,
    });
  }
}

export function showInfoNotification(data: string | NotificationData) {
  showNotification(data, "blue");
}

export function showSuccessNotification(data: string | NotificationData) {
  showNotification(data, "green");
}
