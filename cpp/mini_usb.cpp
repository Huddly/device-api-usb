#include <stdio.h>
#include <stdlib.h>
#include <libusb.h>
#include <unistd.h>

static int count = 0;

  static libusb_device_handle *handle = NULL;
int hotplug_callback_left(struct libusb_context *ctx, struct libusb_device *dev,
                     libusb_hotplug_event event, void *user_data) {

  libusb_close(handle);
  // libusb_unref_device(dev);
  return 0;
}
int hotplug_callback(struct libusb_context *ctx, struct libusb_device *dev,
                     libusb_hotplug_event event, void *user_data) {
  struct libusb_device_descriptor desc;
  int rc;
  (void)libusb_get_device_descriptor(dev, &desc);
  if (LIBUSB_HOTPLUG_EVENT_DEVICE_ARRIVED == event) {
    rc = libusb_open(dev, &handle);
    libusb_ref_device(dev);
    if (LIBUSB_SUCCESS != rc) {
      printf("Could not open USB device\n");
    }

    libusb_device_descriptor ret;
    libusb_get_device_descriptor(dev, &ret);

    libusb_config_descriptor *config;
    int const r = libusb_get_active_config_descriptor(dev, &config);
    if (r != 0) {
        printf("Libusb: libusb_get_active_config_descriptor failed: ");
    } else {
          size_t const num_ifcs = config->bNumInterfaces;
        //std::cout << "Number of interfaces: " << num_ifcs << std::endl;

        const libusb_interface_descriptor * ifc;
        for (int i = 0u; i < num_ifcs; i++) {
            ifc = &config->interface[i].altsetting[0];
            if (ifc->bInterfaceClass == 0xff) {
                break;
            }
        }

        if (!ifc) {
            printf("No vendor specific interface found\n");
        }

        // if (ifc->bNumEndpoints < 2) {
        //     return HLink_error(HLink_error::Errors::endpoint_error, "Incorrect number of endpoints. At least two expected.");
        // }


        int const r = libusb_claim_interface(handle, ifc->bInterfaceNumber);

      if (r != 0) {
        printf("Libusb: open and could get active config for device \n");

      }
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
  libusb_context *ctx;
  libusb_init(&ctx);
  printf("Setup hotplug");
  rc = libusb_hotplug_register_callback(NULL, LIBUSB_HOTPLUG_EVENT_DEVICE_ARRIVED, LIBUSB_HOTPLUG_ENUMERATE, 0x2BD9, 0x21,
                                        LIBUSB_HOTPLUG_MATCH_ANY, hotplug_callback, NULL,
                                        &handle);
  rc = libusb_hotplug_register_callback(NULL, LIBUSB_HOTPLUG_EVENT_DEVICE_LEFT, LIBUSB_HOTPLUG_ENUMERATE, 0x2BD9, 0x21,
                                        LIBUSB_HOTPLUG_MATCH_ANY, hotplug_callback_left, NULL,
                                        &handle);
  if (LIBUSB_SUCCESS != rc) {
    printf("Error creating a hotplug callback\n");
    libusb_exit(NULL);
    return EXIT_FAILURE;
  }
  while (count < 30) {
    printf("processing new handles attach count: %d\n", count);
    libusb_handle_events_completed(NULL, NULL);
    libusb_device **devs;
    ssize_t cnt = libusb_get_device_list(ctx, &devs);
    printf("Found %ld devices \n", cnt);
    libusb_free_device_list(devs, 1);
    usleep(1000);
  }
  libusb_hotplug_deregister_callback(NULL, handle);
  libusb_exit(NULL);
  return 0;
}
