{
  'variables': {
    'use_udev%': 1,
    'use_system_libusb%': 'false',
    'module_name': 'usb_bindings',
    'module_path': './cpp/binding'
  },
  'targets': [
    {
      "target_name": "action_after_build",
      "type": "none",
      'dependencies': [
         "<!(node -p \"require('node-addon-api').gyp\")"
       ],

      "copies": [
        {
          "files": [ "<(PRODUCT_DIR)/usb_bindings.node" ],
          "destination": "./cpp/binding"
        }
      ]
    },
    {
    'target_name': 'usb_bindings',
    "sources": [
        "cpp/bulk_usb.cpp",
        "cpp/queue_uv.cpp",
        "cpp/usb_worker.cpp",
        "cpp/Libusb.cpp",
    ],
      "cflags_cc": [ "-fno-exceptions", "-std=c++17", "-g3", "-Wsuggest-override", "-Weffc++" ],
      'defines': [
        'NAPI_DISABLE_CPP_EXCEPTIONS'
      ],
      'include_dirs': [
         "<!@(node -p \"require('node-addon-api').include\")"
      ],


      'conditions' : [
          ['use_system_libusb=="false" and OS!="freebsd"', {
            'dependencies': [
              'libusb.gypi:libusb',
            ],
          }],
          ['use_system_libusb=="true" or OS=="freebsd"', {
            'include_dirs+': [
              '<!@(pkg-config libusb-1.0 --cflags-only-I | sed s/-I//g)'
            ],
            'libraries': [
              '<!@(pkg-config libusb-1.0 --libs)'
            ],
          }],
          ['OS=="mac"', {
            'xcode_settings': {
              'OTHER_CFLAGS': [ '-std=c++17', '-stdlib=libc++' ],
              'OTHER_LDFLAGS': [ '-framework', 'CoreFoundation', '-framework', 'IOKit' ],
              'SDKROOT': 'macosx',
              'MACOSX_DEPLOYMENT_TARGET': '10.12',
            },
          }],
          ['OS=="win"', {
            'defines':[
              'WIN32_LEAN_AND_MEAN'
            ],
            'default_configuration': 'Release',
            'configurations': {
              'Debug': {
                'defines': [ 'DEBUG', '_DEBUG' ],
                'msvs_settings': {
                  'VCCLCompilerTool': {
                    'RuntimeLibrary': 1, # static debug
                  },
                },
              },
              'Release': {
                'defines': [ 'NDEBUG' ],
                'msvs_settings': {
                  'VCCLCompilerTool': {
                    'RuntimeLibrary': 0, # static release
                  },
                },
              }
            },
            'msvs_settings': {
              'VCCLCompilerTool': {
                'AdditionalOptions': [
                    '/EHsc',
		            '-std:c++17',
				]
              },
            },
            'msvs_disabled_warnings': [ 4267 ],
          }]
      ]
    },
  ]
}
