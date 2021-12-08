import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import cx from 'classnames';
import { ClipLoader } from 'react-spinners';
import { useWeb3React } from '@web3-react/core';
import axios from 'axios';
import { BigNumber, ethers } from 'ethers';
import { useDropzone } from 'react-dropzone';
import Dropzone from "react-dropzone";
import Skeleton from 'react-loading-skeleton';
// import { ChainId } from '@sushiswap/sdk';
import Select from 'react-dropdown-select';

import CloseIcon from '@material-ui/icons/Close';
import { withStyles } from '@material-ui/core/styles';
import { Stepper, Step, StepLabel, Switch } from '@material-ui/core';
import InfoIcon from '@material-ui/icons/Info';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';

import HeaderActions from 'actions/header.actions';
import BootstrapTooltip from 'components/BootstrapTooltip';
import PriceInput from 'components/PriceInput';
import { calculateGasMargin, formatError, getHigherGWEI } from 'utils';
import showToast from 'utils/toast';
import WalletUtils from 'utils/wallet';
import useContract from 'utils/sc.interaction';
import { useApi } from 'api';
import { useSalesContract, getSigner } from 'contracts';

import styles from './styles.module.scss';
import { PageLayout } from 'components/Layouts';

import ReactPlayer from 'react-player';
import { Canvas } from "react-three-fiber";
import { OrbitControls, Stage, Center } from "@react-three/drei";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const accept = ['.jpg', '.png', '.gif', '.webp'];
const media_accept = ['.glb', '.mp4', '.mp3']; // '.gltf', 

const mintSteps = [
  'Uploading to IPFS',
  'Create your NFT',
  'Confirming the Transaction',
];

const FEE_ABI = [
  {
    inputs: [],
    name: 'platformFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const SINGLE_NFT_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_to', type: 'address' },
      { internalType: 'string', name: '_tokenUri', type: 'string' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

const MULTI_NFT_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_supply', type: 'uint256' },
      { internalType: 'string', name: '_uri', type: 'string' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

const PurpleSwitch = withStyles({
  switchBase: {
    color: '#00a59a',
    '&$checked': {
      color: '#00a59a',
    },
    '&$checked + $track': {
      backgroundColor: '#00a59aaa',
    },
  },
  checked: {},
  track: {},
})(Switch);

const PaintBoard = () => {
  const dispatch = useDispatch();
  const history = useHistory();

  const {
    explorerUrl,
    apiUrl,
    fetchMintableCollections,
    getNonce,
    addUnlockableContent,
    checkBan,
  } = useApi();

  const { registerRoyalty } = useSalesContract();
  const { loadContract } = useContract();

  const { account, chainId } = useWeb3React();

  const imageRef = useRef();
  const imageMediaRef = useRef();

  const [selected, setSelected] = useState([]);
  const [collections, setCollections] = useState([]);
  const [nft, setNft] = useState();
  const [type, setType] = useState();
  const [image, setImage] = useState(null);
  const [media, setMedia] = useState(null);
  const [mediaExt, setMediaExt] = useState('');
  const [fee, setFee] = useState(null);

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [royalty, setRoyalty] = useState('');
  const [xtra, setXtra] = useState('');
  ///const [animationUrl, setAnimationUrl] = useState('');
  const [supply, setSupply] = useState(0);
  const [hasUnlockableContent, setHasUnlockableContent] = useState(false);
  const [unlockableContent, setUnlockableContent] = useState('');

  const [currentMintingStep, setCurrentMintingStep] = useState(0);
  const [isMinting, setIsMinting] = useState(false);

  const [lastMintedTnxId, setLastMintedTnxId] = useState('');

  const authToken = useSelector(state => state.ConnectWallet.authToken);

  const getFee = async () => {
    setFee(null);

    try {
      const contract = await loadContract(nft, FEE_ABI);
      const _fee = await contract.platformFee();
      setFee(parseFloat(_fee.toString()) / 10 ** 18);
    } catch {
      setFee(0);
    }
  };

  const getCollections = async () => {
    try {
      console.log('!1 authToken', authToken);
      const { data } = await fetchMintableCollections(authToken);
      setCollections(data);
      if (data.length) {
        setSelected([data[0]]);
      }
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (authToken) {
      getCollections();
    }
  }, [authToken]);

  useEffect(() => {
    if (!nft) return;

    getFee();
  }, [nft]);

  useEffect(() => {
    dispatch(HeaderActions.toggleSearchbar(true));
  }, []);

  // For Media URL //
  const removeMedia = () => {
    setMedia(null);
    if (imageMediaRef.current) {
      imageMediaRef.current.value = '';
    }
  };


  // For main Image //
  const onDrop = useCallback(acceptedFiles => {
    setImage(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    accept: accept.join(', '),
    multiple: false,
    onDrop,
    maxSize: 15728640,
  });

  const removeImage = () => {
    setImage(null);
    if (imageRef.current) {
      imageRef.current.value = '';
    }
  };

  const imageToBase64 = () => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.readAsDataURL(image);
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = err => {
        reject(err);
      };
    });
  };

  const mediaToBase64 = () => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.readAsDataURL(media);
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = err => {
        reject(err);
      };
    });
  };

  const validateMetadata = () => {
    return name !== '' && account !== '' && image;
  };

  const resetMintingStatus = () => {
    setTimeout(() => {
      setIsMinting(false);
      setCurrentMintingStep(0);
    }, 1000);
  };

  const mintNFT = async () => {
    if (!account) {
      showToast('info', 'Connect your wallet first');
      return;
    }
    if (chainId !== 888 && chainId !== 999) {
      showToast('info', 'You are not connected to Wanchain Network');
      return;
    }
    const balance = await WalletUtils.checkBalance(account);

    if (balance < fee) {
      showToast(
        'custom',
        `Your balance should be at least ${fee} WAN to mint an NFT`
      );
      return;
    }

    let isBanned = await checkBan(account, authToken);

    if (isBanned) {
      showToast('error', 'You are banned from minting');
      return;
    }

    setLastMintedTnxId('');
    // show stepper
    setIsMinting(true);
    console.log('created from ', account);
    if (!validateMetadata()) {
      resetMintingStatus();
      return;
    }

    let signature;
    let addr;

    if (hasUnlockableContent && unlockableContent.length > 0) {
      const { data: nonce } = await getNonce(account, authToken);
      try {
        const signer = await getSigner();
        const msg = `Approve Signature on OpenZoo.io with nonce ${nonce}`;
        signature = await signer.signMessage(msg);
        addr = ethers.utils.verifyMessage(msg, signature);
      } catch (err) {
        showToast(
          'error',
          'You need to sign the message to be able to update account settings.'
        );
        resetMintingStatus();
        return;
      }
    }

    // Upload Media First //
    try {
      let animation_url = '';
      if (media) {
        let formData = new FormData();
        
        const mediaBase64 = await mediaToBase64();
        formData.append('media', mediaBase64);
        formData.append('mediaExt', mediaExt);

        let result = await axios({
          method: 'post',
          url: `${apiUrl}/ipfs/uploadImage2Server222`, //TODO: need to change endpoint
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: 'Bearer ' + authToken,
          },
        });

        animation_url = result.data.animation_url;
      }



      let formData = new FormData();
      const base64 = await imageToBase64();
      if (media) {
        formData.append('animation_url', animation_url);
      }
      formData.append('image', base64);
      formData.append('name', name);
      formData.append('account', account);
      formData.append('description', description);
      formData.append('symbol', symbol);

      formData.append('xtra', xtra);
      const _royalty = parseInt(royalty) * 100;
      formData.append('royalty', isNaN(_royalty) ? 0 : _royalty);

      let result = await axios({
        method: 'post',
        url: `${apiUrl}/ipfs/uploadImage2Server`,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: 'Bearer ' + authToken,
        },
      });

      console.log('upload image result is ');

      const jsonHash = result.data.jsonHash;

      const contract = await loadContract(
        nft,
        type === 721 ? SINGLE_NFT_ABI : MULTI_NFT_ABI
      );
      try {
        const args =
          type === 721 ? [account, jsonHash] : [account, supply, jsonHash];

        let tx;

        if (!fee) {
          tx = await contract.mint(...args);
        } else {
          const options = {
            value: ethers.utils.parseEther(fee.toString()),
            gasPrice: getHigherGWEI(),
          };
          const gasEstimate = await contract.estimateGas.mint(...args, options);
          options.gasLimit = calculateGasMargin(gasEstimate);
          tx = await contract.mint(...args, options);
        }
        setCurrentMintingStep(1);
        setLastMintedTnxId(tx.hash);

        setCurrentMintingStep(2);
        const confirmedTnx = await tx.wait();
        setCurrentMintingStep(3);
        let mintedTkId;
        if (type === 721) {
          const evtCaught = confirmedTnx.logs[0].topics;
          mintedTkId = BigNumber.from(evtCaught[3]);
        } else {
          mintedTkId = BigNumber.from(
            ethers.utils.hexDataSlice(confirmedTnx.logs[1].data, 0, 32)
          );
        }

        const royaltyTx = await registerRoyalty(
          nft,
          mintedTkId.toNumber(),
          isNaN(_royalty) ? 0 : _royalty
        );
        await royaltyTx.wait();

        // save unlockable content
        if (hasUnlockableContent && unlockableContent.length > 0) {
          await addUnlockableContent(
            nft,
            mintedTkId.toNumber(),
            unlockableContent,
            signature,
            addr,
            authToken
          );
        }

        showToast('success', 'New NFT item minted!');
        removeImage();
        setName('');
        setSymbol('');
        setDescription('');

        setTimeout(() => {
          history.push(`/explore/${nft}/${mintedTkId.toNumber()}`);
        }, 1000 + Math.random() * 2000);
      } catch (error) {
        showToast('error', formatError(error));
      }
    } catch (error) {
      showToast('error', error.message);
    }
    resetMintingStatus();
  };

  const [threeScence, setThreeScence] = useState(null);
  const ThreeScence = (file) => {


    const reader = new FileReader();
    reader.addEventListener('load', function (event) {

      const contents = event.target.result;

      const loader = new GLTFLoader();
      loader.parse(contents, '', function (gltf) {

        const scene = gltf.scene;
        console.log(scene);
        setThreeScence(scene);
      });

    }, false);
    reader.readAsArrayBuffer(file);
  };


  return (
    <PageLayout containerClassName="form-container-page box">

      <div className={styles.body}>
        <div className={styles.board}>
          <div {...getRootProps({ className: styles.uploadCont })}>
            <input {...getInputProps()} ref={imageRef} />
            {image ? (
              <>
                <img
                  className={styles.image}
                  src={URL.createObjectURL(image)}
                />
                <div className={styles.overlay}>
                  <CloseIcon className={styles.remove} onClick={removeImage} />
                </div>
              </>
            ) : (
              <>
                <div className={styles.uploadtitle}>
                  Drop files here or&nbsp;
                  <span
                    className={styles.browse}
                    onClick={() => imageRef.current?.click()}
                  >
                    browse
                  </span>
                </div>
                <div className={styles.uploadsubtitle}>
                  JPG, PNG, GIF, WEBP Max 15mb.
                </div>
              </>
            )}
          </div>
        </div>
        <div className={styles.panel}>
          <div className={styles.panelInputs}>
            <div className={styles.panelLeft}>
              <div className={styles.formGroup}>
                <p className={styles.formLabel}>Collection</p>
                <Select
                  options={collections}
                  disabled={isMinting}
                  values={selected}
                  onChange={([col]) => {
                    setSelected([col]);
                    setNft(col.erc721Address);
                    setType(col.type);
                  }}
                  className={styles.select}
                  placeholder="Choose Collection"
                  itemRenderer={({ item, methods }) => (
                    <div
                      key={item.erc721Address}
                      className={styles.collection}
                      onClick={() => {
                        methods.clearAll();
                        methods.addItem(item);
                      }}
                    >
                      <img
                        src={`https://openzoo.mypinata.cloud/ipfs/${item.logoImageHash}`}
                        className={styles.collectionLogo}
                      />
                      <div className={styles.collectionName}>
                        {item.collectionName}
                      </div>
                    </div>
                  )}
                  contentRenderer={({ props: { values } }) =>
                    values.length > 0 ? (
                      <div className={styles.collection}>
                        <img
                          src={`https://openzoo.mypinata.cloud/ipfs/${values[0].logoImageHash}`}
                          className={styles.collectionLogo}
                        />
                        <div className={styles.collectionName}>
                          {values[0].collectionName}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.collection} />
                    )
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <p className={styles.formLabel}>Name</p>
                <input
                  type="text"
                  className={styles.formInput}
                  maxLength={40}
                  placeholder="Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isMinting}
                />
                <div className={styles.lengthIndicator}>{name.length}/40</div>
              </div>
              <div className={styles.formGroup}>
                <p className={styles.formLabel}>Symbol</p>
                <input
                  type="text"
                  className={styles.formInput}
                  maxLength={20}
                  placeholder="Symbol"
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  disabled={isMinting}
                />
                <div className={styles.lengthIndicator}>{symbol.length}/20</div>
              </div>
              <div className={styles.formGroup}>
                <p className={styles.formLabel}>Description</p>
                <textarea
                  className={cx(styles.formInput, styles.longInput)}
                  maxLength={120}
                  placeholder="Description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={isMinting}
                />
                <div className={styles.lengthIndicator}>
                  {description.length}/120
                </div>
              </div>
            </div>
            <div className={styles.panelRight}>
              {type === 1155 && (
                <div className={styles.formGroup}>
                  <p className={styles.formLabel}>Supply</p>
                  <PriceInput
                    className={styles.formInput}
                    placeholder="Supply"
                    decimals={0}
                    value={'' + supply}
                    onChange={setSupply}
                    disabled={isMinting}
                  />
                </div>
              )}
              <div className={styles.formGroup}>
                <p className={styles.formLabel}>
                  Royalty (%)&nbsp;
                  <BootstrapTooltip
                    title="If you set a royalty here, you will get X percent of sales price each time an NFT is sold on our platform."
                    placement="top"
                  >
                    <HelpOutlineIcon />
                  </BootstrapTooltip>
                </p>
                <PriceInput
                  className={styles.formInput}
                  placeholder="Royalty"
                  decimals={2}
                  value={'' + royalty}
                  onChange={val =>
                    val[val.length - 1] === '.'
                      ? setRoyalty(val)
                      : setRoyalty(Math.min(100, +val))
                  }
                  disabled={isMinting}
                />
              </div>
              <div className={styles.formGroup}>
                <p className={styles.formLabel}>
                  Media URL (Optional)
                </p>
                <Dropzone onDrop={(acceptedFiles) => {
                  console.log(acceptedFiles[0]);

                  let re = /(?:\.([^.]+))?$/;
                  let ext = re.exec(acceptedFiles[0].name)[1];

                  if (ext) {
                    setMediaExt(ext.toLowerCase());
                    setMedia(acceptedFiles[0]);
                    console.log(URL.createObjectURL(acceptedFiles[0]));
                    // for 3d //
                    if (ext === 'glb')// || ext === 'gltf')
                      ThreeScence(acceptedFiles[0]);
                  }
                  else {
                    setMediaExt(null);
                    setMedia(null);
                  }
                }} name="mediaURL" multiple={false} maxSize="52428800"
                  accept={media_accept.join(', ')}
                >
                  {({ getRootProps, getInputProps }) => (

                    !media && (
                      <div {...getRootProps({ className: styles.uploadCont })} >
                        <input {...getInputProps()} ref={imageMediaRef} />
                        <div className={styles.uploadtitle}>
                          Drop files here or&nbsp;
                          <span
                            className={styles.browse}
                            onClick={() => {
                              imageMediaRef.current?.click();
                              setThreeScence(null);
                            }}
                          >
                            browse
                          </span>
                        </div>
                        <div className={styles.uploadsubtitle}>
                          MP3, MP4, GLB Max 50mb.
                        </div>
                      </div>
                    )

                  )}
                </Dropzone>

                {
                  media && <div className={styles.uploadCont}>
                    {
                      ["mp4"].includes(mediaExt) && <div className='player-wrapper' style={{ width: '100%' }}>
                        <ReactPlayer
                          className={`${cx(styles.mediaInner)} react-player`}
                          url={URL.createObjectURL(media)}
                          controls={true}
                          width="100%"
                          height="100%"
                        />
                      </div>
                    }
                    {
                      ["mp3"].includes(mediaExt) && <div style={{ width: '100%' }}>
                        <ReactPlayer
                          className={`${cx(styles.mediaInner)} react-player`}
                          url={URL.createObjectURL(media)}
                          controls={true}
                          width="100%"
                          height="100%"
                        />
                      </div>
                    }
                    {
                      ["glb"].includes(mediaExt) && threeScence && <Canvas camera={{ fov: 50, near: 0.1, far: 2000 }}>

                        <Suspense fallback={null}>
                          <Center alignTop={false}>
                            <Stage>
                              <primitive object={threeScence} />
                            </Stage>
                          </Center>
                        </Suspense>

                        <OrbitControls autoRotate={true} />
                      </Canvas>
                    }
                    <div className={styles.cornerClose}>
                      <CloseIcon className={styles.remove} onClick={removeMedia} />
                    </div>

                  </div>
                }

              </div>
              <div className={styles.formGroup}>
                <p className={styles.formLabel}>
                  Link to IP Rights Document (Optional)&nbsp;
                  <BootstrapTooltip
                    title="Link to the document which proves your ownership of this image."
                    placement="top"
                  >
                    <HelpOutlineIcon />
                  </BootstrapTooltip>
                </p>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Enter Link"
                  value={xtra}
                  onChange={e => setXtra(e.target.value)}
                  disabled={isMinting}
                />
              </div>
              <div className={styles.formGroup}>
                <p className={styles.formLabel}>
                  Unlockable Content&nbsp;
                  <PurpleSwitch
                    checked={hasUnlockableContent}

                    onChange={e => {
                      setHasUnlockableContent(e.target.checked);
                      setUnlockableContent('');
                    }}
                    name="unlockableContent"
                  />
                </p>
                {hasUnlockableContent && (
                  <textarea
                    className={cx(styles.formInput, styles.longInput)}
                    maxLength={500}
                    placeholder="Unlockable Content"
                    value={unlockableContent}
                    onChange={e => setUnlockableContent(e.target.value)}
                    disabled={isMinting}
                  />
                )}
              </div>
            </div>
          </div>

          {isMinting && (
            <div>
              <Stepper activeStep={currentMintingStep} alternativeLabel>
                {mintSteps.map(label => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </div>
          )}
          <div
            className={cx(
              styles.button,
              (isMinting || !account || !validateMetadata()) && styles.disabled
            )}
            onClick={
              isMinting || !account || !validateMetadata() ? null : mintNFT
            }
          >
            {isMinting ? (
              <ClipLoader size="16" color="white"></ClipLoader>
            ) : (
              'Mint'
            )}
          </div>
          <div className={styles.fee}>
            {fee !== null ? (
              <>
                <InfoIcon />
                &nbsp;{fee} WANs are charged to create a new NFT.
              </>
            ) : (
              <Skeleton width={330} height={22} />
            )}
          </div>
          <div className={styles.mintStatusContainer}>
            {lastMintedTnxId !== '' && (
              <a
                className={styles.tnxAnchor}
                target="_blank"
                rel="noopener noreferrer"
                href={`${explorerUrl}/tx/${lastMintedTnxId}`}
              >
                You can track the last transaction here ...
              </a>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default PaintBoard;
