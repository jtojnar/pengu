{
  description = "Lightweight online chat inspired by Club Penguin";

  inputs = {
    flake-compat = {
      url = "github:edolstra/flake-compat";
      flake = false;
    };

    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, flake-compat, nixpkgs, utils }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShell = pkgs.mkShell {
          nativeBuildInputs = [
            pkgs.nodejs_latest
          ];
        };
      }
    );
}
