#include <stdio.h>
#include <stdlib.h>
#include <libusb.h>
#include <unistd.h>

static int count = 0;
int hotplug_callback(struct libusb_context *ctx, struct libusb_device *dev,
                     libusb_hotplug_event event, void *user_data) {
  static libusb_device_handle *handle = NULL;
  struct libusb_device_descriptor desc;
  int rc;
  (void)libusb_get_device_descriptor(dev, &desc);
  if (LIBUSB_HOTPLUG_EVENT_DEVICE_ARRIVED == event) {
    rc = libusb_open(dev, &handle);
    if (LIBUSB_SUCCESS != rc) {
      printf("Could not open USB device\n");
    }

    libusb_config_descriptor *config;
    int const r = libusb_get_active_config_descriptor(dev, &config);
    if (r != 0) {
        printf("Libusb: libusb_get_active_config_descriptor failed: ");
    } else {
      printf("Libusb: open and could get active config for device \n");
    }
  } else {
    printf("Unhandled event %d\n", event);
  }
  count++;
  return 0;
}

int main(void)
{
  libusb_hotplug_callback_handle handle;
  int rc;
  libusb_init(NULL);
  printf("Setup hotplug");
  rc = libusb_hotplug_register_callback(NULL, LIBUSB_HOTPLUG_EVENT_DEVICE_ARRIVED, LIBUSB_HOTPLUG_ENUMERATE, 0x2BD9, 0x21,
                                        LIBUSB_HOTPLUG_MATCH_ANY, hotplug_callback, NULL,
                                        &handle);
  if (LIBUSB_SUCCESS != rc) {
    printf("Error creating a hotplug callback\n");
    libusb_exit(NULL);
    return EXIT_FAILURE;
  }
  while (count < 30) {
    printf("processing new handles attach count: %d\n", count);
    libusb_handle_events_completed(NULL, NULL);
    usleep(1000);
  }
  libusb_hotplug_deregister_callback(NULL, handle);
  libusb_exit(NULL);
  return 0;
}
