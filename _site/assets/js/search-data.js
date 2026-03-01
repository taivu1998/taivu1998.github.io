// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "About",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-cv",
          title: "CV",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "nav-portfolio",
          title: "Portfolio",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/portfolio/";
          },
        },{id: "nav-contact",
          title: "Contact",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/contact/";
          },
        },{id: "news-welcome-to-my-new-personal-website-i-m-excited-to-share-my-work-in-ai-research-and-engineering-feel-free-to-explore-my-projects-publications-and-experience",
          title: 'Welcome to my new personal website! I’m excited to share my work in...',
          description: "",
          section: "News",},{id: "projects-efficient-reasoner-adaptive-compute-allocation-via-reinforcement-learning",
          title: 'Efficient-Reasoner: Adaptive Compute Allocation via Reinforcement Learning',
          description: "An RL-trained LLM routing between System 1 and System 2 reasoning",
          section: "Projects",handler: () => {
              window.location.href = "/projects/10_efficient_reasoner/";
            },},{id: "projects-vision-r1-visual-system-2-reasoning-via-grpo",
          title: 'Vision-R1: Visual System 2 Reasoning via GRPO',
          description: "A VLM trained with SFT, expert iteration, and GRPO to generate grounded chain-of-thought reasoning over visual math problems",
          section: "Projects",handler: () => {
              window.location.href = "/projects/11_vision_r1/";
            },},{id: "projects-tiny-reason-distilling-reasoning-into-1-5b-parameter-models",
          title: 'Tiny-Reason: Distilling Reasoning into 1.5B Parameter Models',
          description: "A QLoRA fine-tuning pipeline distilling chain-of-thought reasoning into a 1.5B model",
          section: "Projects",handler: () => {
              window.location.href = "/projects/12_tiny_reason/";
            },},{id: "projects-global-deforestation-classifying-forest-loss-drivers-from-satellite-imagery",
          title: 'Global Deforestation: Classifying Forest Loss Drivers from Satellite Imagery',
          description: "A deep learning classification framework of deforestation drivers from multi-temporal Landsat imagery",
          section: "Projects",handler: () => {
              window.location.href = "/projects/13_deforestation/";
            },},{id: "projects-ganime-generating-anime-characters-from-sketches-with-deep-learning",
          title: 'GANime: Generating Anime Characters from Sketches with Deep Learning',
          description: "Generative models for automating the colorization of anime sketches",
          section: "Projects",handler: () => {
              window.location.href = "/projects/14_ganime/";
            },},{id: "projects-flapai-bird-deep-reinforcement-learning-for-flappy-bird",
          title: 'FlapAI Bird: Deep Reinforcement Learning for Flappy Bird',
          description: "A Flappy Bird agent that achieved superhuman performance using reinforcement learning algorithms",
          section: "Projects",handler: () => {
              window.location.href = "/projects/15_flapai_bird/";
            },},{id: "projects-deepanignet-privacy-preserving-recommendation-via-graph-neural-networks",
          title: 'DeepAniGNet: Privacy-Preserving Recommendation via Graph Neural Networks',
          description: "A novel graph-based recommender system using BERT-powered embeddings and graph neutral networks to deliver personalized, privacy-preserving recommendations",
          section: "Projects",handler: () => {
              window.location.href = "/projects/16_privacy_preserving/";
            },},{id: "projects-how-not-to-give-a-flop-combining-regularization-and-structured-pruning",
          title: 'How Not to Give a FLOP: Combining Regularization and Structured Pruning',
          description: "A systematic study of regularization and network pruning techniques on ResNets",
          section: "Projects",handler: () => {
              window.location.href = "/projects/17_resnet_pruning/";
            },},{id: "projects-manganet-object-detection-for-manga-with-deep-neural-networks",
          title: 'MangaNet: Object Detection for Manga with Deep Neural Networks',
          description: "Advanced object detection model architectures for the manga domain",
          section: "Projects",handler: () => {
              window.location.href = "/projects/18_manga_detection/";
            },},{id: "projects-gapbuffer-header-only-c-17-text-editor-data-structure",
          title: 'GapBuffer: Header-Only C++17 Text Editor Data Structure',
          description: "A simple C++ text editor that efficiently moves its cursor, accesses different positions, adds and removes characters, and edits texts",
          section: "Projects",handler: () => {
              window.location.href = "/projects/19_gap_buffer/";
            },},{id: "projects-nano-reasoner-unified-post-training-framework-for-math-reasoning-models",
          title: 'Nano-Reasoner: Unified Post-Training Framework for Math Reasoning Models',
          description: "An end-to-end research-grade, memory-efficient post-training pipeline for reasoning models with SFT and RL",
          section: "Projects",handler: () => {
              window.location.href = "/projects/1_nano_reasoner/";
            },},{id: "projects-graphviz-force-directed-graph-layout-with-real-time-qt-animation",
          title: 'GraphViz: Force-Directed Graph Layout with Real-Time Qt Animation',
          description: "A C++ implementation of the Fruchterman-Reingold algorithm for visualizing nodes and edges in a graph",
          section: "Projects",handler: () => {
              window.location.href = "/projects/20_graph_viz/";
            },},{id: "projects-prm-math-inference-time-compute-scaling-via-dense-process-supervision",
          title: 'PRM-Math: Inference-Time Compute Scaling via Dense Process Supervision',
          description: "Cutting-edge inference-time compute scaling strategies with a fine-tuned Process Reward Model",
          section: "Projects",handler: () => {
              window.location.href = "/projects/2_prm_math/";
            },},{id: "projects-nano-video-gen-spacetime-diffusion-transformer-with-rectified-flow-matching",
          title: 'Nano-Video-Gen: Spacetime Diffusion Transformer with Rectified Flow Matching',
          description: "A Diffusion Transformer video generator from scratch with 3D spacetime patch embeddings and Rectified Flow Matching",
          section: "Projects",handler: () => {
              window.location.href = "/projects/3_nano_video_gen/";
            },},{id: "projects-agentic-deep-research-recursive-reasoning-and-self-correction-engine",
          title: 'Agentic Deep Research: Recursive Reasoning and Self-Correction Engine',
          description: "A multi-agent deep research engine with dynamic DAGs, self-correction loops, and LLM-as-a-Judge evaluation",
          section: "Projects",handler: () => {
              window.location.href = "/projects/4_agentic_deep_research/";
            },},{id: "projects-connaisseur-cross-domain-recipe-recommendation-via-bert-embedding-transfer",
          title: 'ConnAIsseur: Cross-Domain Recipe Recommendation via BERT Embedding Transfer',
          description: "A full-stack AI recipe platform using domain-adaptive BERT pre-training, cross-domain semantic alignment from restaurant reviews to recipes, and KNN retrieval",
          section: "Projects",handler: () => {
              window.location.href = "/projects/5_connaisseur/";
            },},{id: "projects-video-dpo-temporal-alignment-for-video-diffusion-via-direct-preference-optimization",
          title: 'Video-DPO: Temporal Alignment for Video Diffusion via Direct Preference Optimization',
          description: "DPO for video diffusion models, aligning generation for temporal stability and motion smoothness",
          section: "Projects",handler: () => {
              window.location.href = "/projects/5_video_dpo/";
            },},{id: "projects-photoshare-full-stack-spa-with-per-photo-visibility-control",
          title: 'PhotoShare: Full-Stack SPA with Per-Photo Visibility Control',
          description: "A photo-sharing web application with user authentication, user profiles, user listing, photo sharing, favorite lists, commenting, and activity feeds",
          section: "Projects",handler: () => {
              window.location.href = "/projects/6_photo_sharing/";
            },},{id: "projects-visual-cot-pixel-grounded-reasoning-with-multi-modal-chain-of-thought",
          title: 'Visual-CoT: Pixel-Grounded Reasoning with Multi-Modal Chain-of-Thought',
          description: "Fine-tuned VLM generating interleaved reasoning traces with bounding box coordinates, reducing object hallucination",
          section: "Projects",handler: () => {
              window.location.href = "/projects/6_visual_cot/";
            },},{id: "projects-stockviz-real-time-pairs-trading-dashboard-with-jpmorgan-perspective",
          title: 'StockViz: Real-Time Pairs Trading Dashboard with JPMorgan Perspective',
          description: "A full-stack streaming analytics dashboard computing dual-stock mid-price ratios with static threshold bands and trigger alerts",
          section: "Projects",handler: () => {
              window.location.href = "/projects/7_stock_charts/";
            },},{id: "projects-tool-use-dpo-schema-constrained-alignment-via-identity-preference-optimization",
          title: 'Tool-Use DPO: Schema-Constrained Alignment via Identity Preference Optimization',
          description: "LLM alignment for rigid API contract adherence using IPO with hard negatives",
          section: "Projects",handler: () => {
              window.location.href = "/projects/7_tool_use_dpo/";
            },},{id: "projects-shiptivitas-kanban-board-with-dragula-react-reconciliation",
          title: 'Shiptivitas: Kanban Board with Dragula-React Reconciliation',
          description: "A full-stack to-do list web application based on a kanban board",
          section: "Projects",handler: () => {
              window.location.href = "/projects/8_shiptivitas/";
            },},{id: "projects-web-browser-agent-multimodal-autonomous-web-navigation-via-visual-grounding",
          title: 'Web-Browser-Agent: Multimodal Autonomous Web Navigation via Visual Grounding',
          description: "A multimodal autonomous web agent with a VLM, a hybrid Set-of-Mark pipeline, and a Verify-Act-Verify loop",
          section: "Projects",handler: () => {
              window.location.href = "/projects/8_web_browser_agent/";
            },},{id: "projects-data-scientist-agent-multimodal-code-actuated-agent-via-visual-verification",
          title: 'Data-Scientist-Agent: Multimodal Code-Actuated Agent via Visual Verification',
          description: "An autonomous data science agent for data analytics and visualization, with a VLM critic for visual verification",
          section: "Projects",handler: () => {
              window.location.href = "/projects/9_data_scientist_agent/";
            },},{id: "projects-game-2048-algorithmic-puzzle-with-array-reversal-conjugation",
          title: 'Game 2048: Algorithmic Puzzle with Array Reversal Conjugation',
          description: "A minimal Java implementation of the game 2048",
          section: "Projects",handler: () => {
              window.location.href = "/projects/9_game_2048/";
            },},{
        id: 'social-cv',
        title: 'CV',
        section: 'Socials',
        handler: () => {
          window.open("/assets/pdf/resume.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%74%61%69%64%75%63%76%75%31%39%39%38@%67%6D%61%69%6C.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-rss',
        title: 'RSS Feed',
        section: 'Socials',
        handler: () => {
          window.open("/feed.xml", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
