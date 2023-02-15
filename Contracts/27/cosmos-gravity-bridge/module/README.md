## Building

On first run:
```
sudo dnf install make automake gcc gcc-c++ kernel-devel

make

make test

make proto-update-deps

sudo make proto-tools
```

Following builds and test:
```
make
make test
```

To update protos after editing .proto files
```
make proto-gen
```
